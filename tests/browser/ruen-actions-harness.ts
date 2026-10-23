import { expect, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { Simulation, type Commands, type Player } from '../../src/core/Simulation';
import type { FollowCamera } from '../../src/camera/FollowCamera';
import type { RuenLocomotionView } from '../../src/assets/RuenLocomotionView';
import { freshSave, SAVE_KEY } from '../../src/progression/save';

export type ActionRole = 'hurt' | 'death' | 'interact' | 'victory';
export interface ActionDiagnostic {
  state: ActionRole | null; clip: string | null; frame: number | null; time: number;
  phase: number; entryWeight: number; error: string | null; moving: boolean;
}
export type Controller = Omit<Player, 'hitIds'>;
export interface Sample {
  age: number; mode: string; modeTime: number; player: Controller; target: string | null;
  representation: string; actions: ActionDiagnostic;
  combat: RuenLocomotionView['diagnostics']['combat'] & { airborne: { state: 'jump' | 'fall'; frame: number; time: number } | null };
  traversal: RuenLocomotionView['diagnostics']['traversal'];
  directional: { state: 'walk' | 'run' | null; frame: number | null; phase: number; direction: number;
    weights: { forward: number; left: number; right: number; back: number }; error: string | null };
  clips: { name: string; frame: number; weight: number; playing: boolean }[];
  originalPlaying: string[]; rootError: number; rootYaw: number;
  gear: { kind: string; enabled: boolean; parent: string | undefined; gripError: number; scale: number[] }[];
}
interface StepSample {
  age: number; mode: string; modeTime: number; player: Controller; dt: number; input: Commands;
  events: { type: string; damage?: number }[];
}
interface Evidence {
  initial: { serialized: string; hitIds: string[] }; renders: Sample[]; steps: StepSample[];
  captures: Record<string, string>; stop: () => void;
}
export type ActionWindow = Window & {
  __veylun: { sim: Simulation; camera: FollowCamera; locomotion: RuenLocomotionView };
  ruenActionEvidence: Evidence;
  ruenActionPad: { axes: number[]; buttons: { pressed: boolean; touched: boolean; value: number }[] };
};

export const duration = { hurt: .3, death: 1.25, interact: .5, victory: 3 };
export const names = { hurt: 'Ruen_Hurt_Equipped', death: 'Ruen_Death_Equipped', interact: 'Ruen_Interact_Equipped', victory: 'Ruen_Victory_Equipped' };

export async function start(page: Page, seed: 'fresh' | 'ruins' | 'altar' = 'fresh', pad = false) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !message.text().includes('pointer lock')) errors.push(message.text()); });
  if (seed !== 'fresh') {
    const save = freshSave();
    Object.assign(save, { checkpoint: 'after-sprouts', reachedZone: 'ruins', defeatedOrdinaryEnemies: ['sprout-1', 'sprout-2', 'spirit-1'] });
    if (seed === 'altar') Object.assign(save, { checkpoint: 'before-guardian', reachedZone: 'guardian', hasKey: true,
      chestOpened: true, switchActivated: true, grateOpened: true, doorUnlocked: true, bossDefeated: true });
    await page.addInitScript(({ key, save }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(save)); }, { key: SAVE_KEY, save });
  }
  if (pad) await page.addInitScript(() => {
    const pad = { id: 'Xbox Ruen directional QA', index: 0, connected: true, mapping: 'standard', timestamp: 0,
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
    Object.assign(window, { ruenActionPad: pad });
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad] });
  });
  await page.goto('/?test=1');
  await expect(page.locator('#ruen-model-status')).toHaveAttribute('data-equipment-status', 'ready', { timeout: 150000 });
  await page.getByRole('button', { name: seed === 'fresh' ? 'Nueva partida' : 'Continuar aventura', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
  await page.getByLabel('Sombras').uncheck();
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  return errors;
}

export async function observe(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as ActionWindow, { sim, camera, locomotion } = w.__veylun;
    w.ruenActionEvidence?.stop();
    const player = (): Controller => { const { hitIds: _ids, ...p } = sim.player; return p; };
    const evidence: Evidence = { initial: { serialized: JSON.stringify(sim), hitIds: [...sim.player.hitIds] }, renders: [], steps: [], captures: {}, stop: () => {} };
    w.ruenActionEvidence = evidence;
    const step = sim.step.bind(sim);
    sim.step = (dt, input) => {
      const from = sim.events.length; step(dt, input);
      evidence.steps.push({ age: sim.age, mode: sim.mode, modeTime: sim.modeTime, player: player(), dt, input: { ...input },
        events: sim.events.slice(from).map(event => ({ ...event })) });
    };
    const transform = (point: readonly number[], m: ArrayLike<number>) => [
      point[0]! * m[0]! + point[1]! * m[4]! + point[2]! * m[8]! + m[12]!,
      point[0]! * m[1]! + point[1]! * m[5]! + point[2]! * m[9]! + m[13]!,
      point[0]! * m[2]! + point[1]! * m[6]! + point[2]! * m[10]! + m[14]!,
    ];
    const scene = camera.camera.getScene();
    const observer = scene.onAfterRenderObservable.add(() => {
      const model = locomotion.model!, equipment = locomotion.equipment!, d = locomotion.diagnostics;
      const sample: Sample = { age: sim.age, mode: sim.mode, modeTime: sim.modeTime, player: player(), target: sim.targetId,
        representation: d.representation, actions: d.actions, combat: d.combat, traversal: d.traversal, directional: d.directional,
        clips: model.container.animationGroups.filter(group => !model.report.animationGroups.some(original => original.name === group.name))
          .map(group => ({ name: group.name, frame: group.getCurrentFrame(), weight: group.weight, playing: group.isPlaying })),
        originalPlaying: model.container.animationGroups.filter(group => group.isPlaying && model.report.animationGroups.some(original => original.name === group.name)).map(group => group.name),
        rootError: Math.hypot(model.root.position.x - sim.player.x, model.root.position.y - sim.player.y, model.root.position.z - sim.player.z),
        rootYaw: model.root.rotation.y,
        gear: equipment.models.map(item => {
          const profile = equipment.report.items.find(profile => profile.kind === item.kind)!;
          const hand = model.container.transformNodes.find(node => node.name === profile.hand)!;
          const gripWorld = transform(profile.grip, item.model.root.computeWorldMatrix(true).asArray());
          const grip = transform(gripWorld, hand.computeWorldMatrix(true).clone().invert().asArray());
          return { kind: item.kind, enabled: item.mount.isEnabled(), parent: item.mount.parent?.name,
            gripError: Math.hypot(...grip.map((value, axis) => value - profile.handOffset[axis]!)), scale: item.mount.scaling.asArray() };
        }),
      };
      evidence.renders.push(sample);
      const label = d.actions.state ?? (d.combat.airborne ? `air-${d.combat.state}` : d.directional.state ? `${d.directional.state}-directional` : null);
      if (label && !evidence.captures[label] && (!d.actions.state || d.actions.phase > .25)) evidence.captures[label] = scene.getEngine().getRenderingCanvas()!.toDataURL('image/png');
    });
    evidence.stop = () => { scene.onAfterRenderObservable.remove(observer); sim.step = step; };
  });
}

export async function saveEvidence(page: Page, info: TestInfo, label: string, errors: string[]) {
  const evidence = await page.evaluate(() => {
    const e = (window as unknown as ActionWindow).ruenActionEvidence; e.stop();
    return { initial: e.initial, steps: e.steps, renders: e.renders, captures: e.captures };
  });
  const initial = JSON.parse(evidence.initial.serialized) as Simulation;
  const replay = new Simulation(initial.save); Object.assign(replay, initial); replay.player.hitIds = new Set(evidence.initial.hitIds);
  const mismatches: string[] = []; let maxDelta = 0;
  const compare = (key: string, actual: unknown, expected: unknown) => {
    if (typeof actual === 'number' && typeof expected === 'number') {
      const delta = Math.abs(actual - expected); maxDelta = Math.max(maxDelta, delta);
      if (delta > 1e-8 && mismatches.length < 10) mismatches.push(`${key}: ${actual} != ${expected}`);
    } else if (actual !== expected && mismatches.length < 10) mismatches.push(`${key}: ${actual} != ${expected}`);
  };
  for (const [index, step] of evidence.steps.entries()) {
    replay.events.length = 0; replay.step(step.dt, step.input);
    compare(`${index}.age`, step.age, replay.age); compare(`${index}.modeTime`, step.modeTime, replay.modeTime); compare(`${index}.mode`, step.mode, replay.mode);
    for (const key of Object.keys(step.player) as (keyof Controller)[]) compare(`${index}.${key}`, step.player[key], replay.player[key]);
  }
  for (const [role, data] of Object.entries(evidence.captures)) {
    const path = info.outputPath(`${label}-${role}.png`); await writeFile(path, Buffer.from(data.split(',')[1]!, 'base64'));
    await info.attach(`${label}-${role}.png`, { path, contentType: 'image/png' });
  }
  await info.attach(`${label}.json`, { body: JSON.stringify({ ...evidence, captures: Object.keys(evidence.captures), replay: { steps: evidence.steps.length, maxDelta, mismatches }, errors }, null, 2), contentType: 'application/json' });
  expect(mismatches).toEqual([]); expect(errors).toEqual([]);
  return evidence;
}

export function equipped(sample: Sample) {
  expect(sample.representation).toBe('meshy'); expect(sample.rootError).toBeLessThan(.00001);
  expect(sample.rootYaw).toBeCloseTo(sample.player.yaw, 7); expect(sample.originalPlaying).toEqual([]);
  expect(sample.gear).toHaveLength(2);
  for (const item of sample.gear) {
    expect(item.enabled).toBe(true);
    expect(item.parent).toBe(item.kind === 'sword' ? 'mixamorig:RightHand' : 'mixamorig:LeftHand');
    expect(item.gripError).toBeLessThan(.0001); // Float32 transforms at distant level coordinates.
    item.scale.forEach(value => expect(value).toBeCloseTo(item.kind === 'sword' ? .55 : .294, 8));
  }
}

export function actionSample(sample: Sample, role: ActionRole) {
  equipped(sample);
  const time = Math.min(duration[role], role === 'death' || role === 'victory' ? sample.modeTime : sample.player.stateTime);
  expect(sample.actions.state).toBe(role); expect(sample.actions.clip).toBe(names[role]); expect(sample.actions.error).toBeNull();
  expect(sample.actions.time).toBeCloseTo(time, 7); expect(sample.actions.frame).toBeCloseTo(time * 60, 5);
  expect(sample.actions.phase).toBeCloseTo(time / duration[role], 7);
  const group = sample.clips.find(clip => clip.name === names[role])!;
  expect(group.playing).toBe(false); expect(group.frame).toBeCloseTo(time * 60, 5);
}

export async function pauseDuring(page: Page, role: ActionRole, from: number) {
  await page.evaluate(({ role, from }) => new Promise<void>((resolve, reject) => {
    const w = window as unknown as ActionWindow, deadline = performance.now() + 90000;
    const frame = () => {
      const sim = w.__veylun.sim;
      const time = role === 'death' || role === 'victory' ? sim.modeTime : sim.player.stateTime;
      if (sim.player.state === role && time >= from) {
        for (const type of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(type, { code: 'Escape', bubbles: true }));
        resolve(); return;
      }
      if (performance.now() > deadline) { reject(new Error(`No real ${role} event before pause: ${sim.player.state}/${sim.mode}`)); return; }
      requestAnimationFrame(frame);
    }; requestAnimationFrame(frame);
  }), { role, from });
  await expect(page.getByRole('heading', { name: 'Pausa' })).toBeVisible();
  const snapshot = () => page.evaluate(() => {
    const { sim, locomotion } = (window as unknown as ActionWindow).__veylun;
    return { age: sim.age, modeTime: sim.modeTime, stateTime: sim.player.stateTime, actions: locomotion.diagnostics.actions,
      pose: locomotion.model!.container.transformNodes.map(node => [node.position.asArray(), node.rotationQuaternion?.asArray()]) };
  });
  const before = await snapshot(); expect(before.actions.state).toBe(role);
  await page.waitForTimeout(300); expect(await snapshot()).toEqual(before);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
}

export async function idle(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const { sim, locomotion } = (window as unknown as ActionWindow).__veylun;
    return sim.player.state === 'idle' && sim.mode === 'playing' && locomotion.diagnostics.actions.state === null && locomotion.diagnostics.weights.idle === 1;
  }), { timeout: 30000 }).toBe(true);
}
