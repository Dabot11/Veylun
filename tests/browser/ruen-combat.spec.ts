import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import type { Simulation } from '../../src/core/Simulation';
import type { FollowCamera } from '../../src/camera/FollowCamera';
import type { RuenLocomotionView } from '../../src/assets/RuenLocomotionView';
import { attacks } from '../../src/player/combat';

test.use({ baseURL: 'http://127.0.0.1:5174', viewport: { width: 800, height: 600 } });
test.setTimeout(300000);

type Device = 'keyboard' | 'mouse' | 'gamepad';
type CombatRole = 'shield' | 'block' | 'attack1' | 'attack2' | 'attack3';
interface CombatDiagnostic {
  state: CombatRole | null; clip: string | null; frame: number | null; time: number;
  phase: 'guard' | 'block' | 'windup' | 'active' | 'recovery' | null;
  entryWeight: number; guardMoving: boolean; guardDirection: number; guardFrame: number;
}
interface RenderSample {
  age: number; state: string; combo: number; attackTime: number; health: number; hp: number[];
  position: number[]; target: string | null; representation: string; combat: CombatDiagnostic;
  weights: number[]; originalPlaying: string[]; rootError: number; groupFrame: number | null; arms: number[][];
  traversal: RuenLocomotionView['diagnostics']['traversal'];
  gear: { kind: string; enabled: boolean; parent: string | undefined; gripError: number; scale: number[] }[];
}
interface StepSample {
  age: number; state: string; combo: number; attackTime: number; queued: boolean; health: number; hp: number[];
  events: { type: string; damage?: number; strong?: boolean; enemyId?: string }[];
}
interface Evidence {
  renders: RenderSample[]; steps: StepSample[]; captures: Record<string, string>; stop: () => void;
}
type TestWindow = Window & {
  __veylun: { sim: Simulation; camera: FollowCamera; locomotion: RuenLocomotionView };
  ruenCombatPad: { axes: number[]; buttons: { pressed: boolean; touched: boolean; value: number }[] };
  ruenCombatEvidence: Evidence;
};

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('pointer lock')) errors.push(message.text());
  });
  return errors;
}

async function startTrial(page: Page, device: Device = 'keyboard'): Promise<void> {
  if (device === 'gamepad') await page.addInitScript(() => {
    const pad = { id: 'Xbox Ruen combat QA', index: 0, connected: true, mapping: 'standard', timestamp: 0,
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
    Object.assign(window, { ruenCombatPad: pad });
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad] });
  });
  await page.goto('/?test=1');
  await expect(page.locator('body')).toHaveAttribute('data-engine', 'ready', { timeout: 60000 });
  await expect(page.locator('#ruen-model-status')).toHaveAttribute('data-equipment-status', 'ready', { timeout: 120000 });
  await page.getByRole('button', { name: 'Nueva partida', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
  await page.getByLabel('Sombras').uncheck();
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
}

/** Read the controller after each real fixed step and the visual after each render.
 * Neither observer writes controller state, animation poses, health or damage.
 */
async function collectEvidence(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as TestWindow, { sim, camera, locomotion } = w.__veylun;
    w.ruenCombatEvidence?.stop();
    const evidence: Evidence = { renders: [], steps: [], captures: {}, stop: () => {} };
    w.ruenCombatEvidence = evidence;
    const step = sim.step.bind(sim);
    sim.step = (dt, input) => {
      const eventStart = sim.events.length;
      step(dt, input);
      const p = sim.player;
      evidence.steps.push({ age: sim.age, state: p.state, combo: p.combo, attackTime: p.attackTime, queued: p.queued,
        health: p.health, hp: sim.enemies.map(enemy => enemy.hp), events: sim.events.slice(eventStart).map(event => ({ ...event })) });
    };
    const transform = (point: readonly number[], matrix: ArrayLike<number>) => [
      point[0]! * matrix[0]! + point[1]! * matrix[4]! + point[2]! * matrix[8]! + matrix[12]!,
      point[0]! * matrix[1]! + point[1]! * matrix[5]! + point[2]! * matrix[9]! + matrix[13]!,
      point[0]! * matrix[2]! + point[1]! * matrix[6]! + point[2]! * matrix[10]! + matrix[14]!,
    ];
    const scene = camera.camera.getScene();
    const observer = scene.onAfterRenderObservable.add(() => {
      const model = locomotion.model!, equipment = locomotion.equipment!, p = sim.player;
      const diagnostics = locomotion.diagnostics as typeof locomotion.diagnostics & { combat: CombatDiagnostic };
      const sample: RenderSample = {
        age: sim.age, state: p.state, combo: p.combo, attackTime: p.attackTime, health: p.health,
        hp: sim.enemies.map(enemy => enemy.hp), position: [p.x, p.y, p.z], target: sim.targetId,
        representation: diagnostics.representation, combat: diagnostics.combat, traversal: diagnostics.traversal,
        groupFrame: model.container.animationGroups.find(group => group.name === diagnostics.combat.clip)?.getCurrentFrame() ?? null,
        arms: model.container.transformNodes.filter(node => /mixamorig:(Left|Right)(Arm|ForeArm|Hand)$/.test(node.name))
          .map(node => node.rotationQuaternion!.asArray()),
        weights: Object.values(diagnostics.weights),
        originalPlaying: model.container.animationGroups.filter(group =>
          group.isPlaying && model.report.animationGroups.some(original => original.name === group.name)).map(group => group.name),
        rootError: Math.hypot(model.root.position.x - p.x, model.root.position.y - p.y, model.root.position.z - p.z),
        gear: equipment.models.map(item => {
          const profile = equipment.report.items.find(profile => profile.kind === item.kind)!;
          const hand = model.container.transformNodes.find(node => node.name === profile.hand)!;
          const gripWorld = transform(profile.grip, item.model.root.computeWorldMatrix(true).asArray());
          const gripInHand = transform(gripWorld, hand.computeWorldMatrix(true).clone().invert().asArray());
          return { kind: item.kind, enabled: item.mount.isEnabled(), parent: item.mount.parent?.name,
            gripError: Math.hypot(...gripInHand.map((value, axis) => value - profile.handOffset[axis]!)),
            scale: item.mount.scaling.asArray() };
        }),
      };
      evidence.renders.push(sample);
      const role = sample.combat.state;
      // Canvas pixels are read in this rendered frame, before WebGL discards its
      // buffer. This captures short active windows without pausing the controller.
      if (role && !evidence.captures[role] && sample.representation === 'meshy' &&
        (sample.combat.phase === 'active' || role === 'block' || role === 'shield' && sample.combat.entryWeight >= .99)) {
        evidence.captures[role] = scene.getEngine().getRenderingCanvas()!.toDataURL('image/png');
      }
    });
    evidence.stop = () => { scene.onAfterRenderObservable.remove(observer); sim.step = step; };
  });
}

async function saveEvidence(page: Page, info: TestInfo, label: string, errors: string[]) {
  const evidence = await page.evaluate(() => {
    const evidence = (window as TestWindow).ruenCombatEvidence;
    evidence.stop();
    return { renders: evidence.renders, steps: evidence.steps, captures: evidence.captures };
  });
  for (const [role, dataUrl] of Object.entries(evidence.captures)) {
    await writeFile(info.outputPath(`${label}-${role}.png`), Buffer.from(dataUrl.split(',')[1]!, 'base64'));
  }
  await info.attach(`${label}.json`, { body: JSON.stringify({ renders: evidence.renders, steps: evidence.steps }, null, 2), contentType: 'application/json' });
  await info.attach(`${label}-console.json`, { body: JSON.stringify(errors, null, 2), contentType: 'application/json' });
  expect(errors).toEqual([]);
  return evidence;
}

function expectEquipped(sample: RenderSample): void {
  expect(sample.representation).toBe('meshy');
  expect(sample.rootError).toBeLessThan(.00001);
  expect(sample.originalPlaying).toEqual([]);
  expect(sample.gear).toHaveLength(2);
  for (const item of sample.gear) {
    expect(item.enabled).toBe(true);
    expect(item.parent).toBe(item.kind === 'sword' ? 'mixamorig:RightHand' : 'mixamorig:LeftHand');
    // The arena is ~112 world units from the origin. Float32 world matrices and
    // their inverse accumulate ~1e-5 here; 0.1 mm still detects detached grips.
    expect(item.gripError).toBeLessThan(.0001);
    item.scale.forEach(scale => expect(scale).toBeCloseTo(item.kind === 'sword' ? .55 : .294, 8));
  }
}

async function originalClipFingerprint(page: Page) {
  return page.evaluate(() => {
    const model = (window as TestWindow).__veylun.locomotion.model!;
    return model.report.animationGroups.map(original => {
      const group = model.container.animationGroups.find(group => group.name === original.name)!;
      const data = JSON.stringify(group.targetedAnimations.map(({ target, animation }) => ({
        target: target.name, property: animation.targetProperty, keys: animation.getKeys(),
      })));
      let hash = 2166136261;
      for (let index = 0; index < data.length; index++) hash = Math.imul(hash ^ data.charCodeAt(index), 16777619);
      return { name: group.name, from: group.from, to: group.to, tracks: group.targetedAnimations.length, hash: hash >>> 0 };
    });
  });
}

async function combo(page: Page, device: Device): Promise<number[]> {
  // Input edges run on animation frames, as in the Guardian encounter suite.
  // Waiting for CDP/HUD reads between presses can miss a short combo window.
  return page.evaluate(device => new Promise<number[]>((resolve, reject) => {
    const w = window as TestWindow, game = w.__veylun.sim, initial = game.age;
    const deadline = performance.now() + 45000, seen = new Set<number>();
    let phase = 0, releasedAt = 0;
    const attack = (down: boolean): void => {
      if (device === 'keyboard') window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code: 'KeyJ', bubbles: true }));
      else if (device === 'mouse') (down ? document.querySelector('canvas')! : window)
        .dispatchEvent(new MouseEvent(down ? 'mousedown' : 'mouseup', { button: 0, bubbles: true }));
      else Object.assign(w.ruenCombatPad.buttons[2]!, { pressed: down, touched: down, value: down ? 1 : 0 });
    };
    attack(true);
    function frame(): void {
      const p = game.player;
      if (p.combo) seen.add(p.combo);
      if (game.age - initial > 4 || performance.now() > deadline) {
        attack(false); reject(new Error(`Combo timed out: phase=${phase}, combo=${p.combo}, hp=${game.enemies[3]!.hp}`)); return;
      }
      if (phase === 0 && p.combo === 1) { attack(false); releasedAt = game.age; phase = 1; }
      else if (phase === 1 && game.age > releasedAt) { attack(true); phase = 2; }
      else if (phase === 2 && (p.queued || p.combo === 2)) { attack(false); releasedAt = game.age; phase = 3; }
      else if (phase === 3 && game.age > releasedAt && p.combo === 2) { attack(true); phase = 4; }
      else if (phase === 4 && (p.queued || p.combo === 3)) { attack(false); phase = 5; }
      else if (phase === 5 && p.combo === 0) { resolve([...seen]); return; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }), device);
}

for (const device of ['keyboard', 'mouse', 'gamepad'] as const) {
  test(`${device}: equipped combo 1–2–3 follows the controller clock and preserves 1/1/2 damage`, async ({ page }, info) => {
    const errors = collectErrors(page);
    await startTrial(page, device);
    await page.evaluate(device => {
      const { sim, camera } = (window as TestWindow).__veylun;
      // Existing arena progress and a waiting Guardian are the encounter fixture.
      // Its normal 12 HP and all player attack/damage code remain unchanged.
      Object.assign(sim.save, { doorUnlocked: true, reachedZone: 'guardian' });
      Object.assign(sim.player, { x: 0, z: 111.9, y: .6, yaw: 0, vx: 0, vz: 0 });
      Object.assign(sim.enemies[3]!, { state: 'recover', timer: -10 });
      camera.reset(sim);
      camera.yaw = device === 'keyboard' ? Math.PI * .75 : device === 'mouse' ? Math.PI / 2 : .4;
      camera.pitch = .15;
    }, device);
    const sourceClips = await originalClipFingerprint(page);
    await collectEvidence(page);
    expect(await combo(page, device)).toEqual([1, 2, 3]);
    await expect.poll(() => page.evaluate(() => (window as TestWindow).__veylun.locomotion.diagnostics.weights.idle)).toBe(1);
    const evidence = await saveEvidence(page, info, `equipped-combo-${device}`, errors);
    expect(await originalClipFingerprint(page)).toEqual(sourceClips);
    const hits = evidence.steps.flatMap(step => step.events.filter(event => event.type === 'hit' && event.enemyId === 'guardian')
      .map(event => ({ combo: step.combo, time: step.attackTime, damage: event.damage, hp: step.hp[3] })));
    expect(hits.map(hit => [hit.combo, hit.damage, hit.hp])).toEqual([[1, 1, 11], [2, 1, 10], [3, 2, 8]]);
    for (const hit of hits) {
      const timing = attacks[hit.combo - 1]!;
      expect(hit.time).toBeGreaterThanOrEqual(timing.windup);
      expect(hit.time).toBeLessThan(timing.activeEnd);
    }
    for (let index = 1; index <= 3; index++) {
      const role = `attack${index}`;
      const samples = evidence.renders.filter(sample => sample.state === role);
      expect(samples.length).toBeGreaterThan(2);
      expect(samples.some(sample => sample.combat.phase === 'active')).toBe(true);
      expect(samples.some(sample => sample.combat.phase === 'recovery')).toBe(true);
      expect(samples.at(-1)!.arms).not.toEqual(samples[0]!.arms);
      expect(evidence.captures[role]).toMatch(/^data:image\/png;base64,/);
      for (const sample of samples) {
        expectEquipped(sample);
        expect(sample.combat.state).toBe(role);
        expect(sample.combat.clip).toBe(`Ruen_Attack${index}_Equipped`);
        expect(sample.combat.frame).toBeCloseTo(sample.attackTime * 60, 5);
        expect(sample.groupFrame).toBeCloseTo(sample.attackTime * 60, 5);
        const timing = attacks[index - 1]!;
        expect(sample.combat.phase).toBe(sample.attackTime < timing.windup ? 'windup' : sample.attackTime < timing.activeEnd ? 'active' : 'recovery');
        expect(sample.weights.every(weight => weight === 0)).toBe(true);
      }
    }
    expect(evidence.steps.every(step => step.health === 10)).toBe(true);
  });
}

test('real shield input blocks a Brote hit and keeps equipped guard while moving under lock-on', async ({ page }, info) => {
  const errors = collectErrors(page);
  await startTrial(page);
  await page.keyboard.down('KeyK');
  await page.evaluate(() => {
    const { sim, camera } = (window as TestWindow).__veylun;
    Object.assign(sim.player, { x: -2, z: 26, y: 0, yaw: 0, vx: 0, vz: 0 });
    camera.reset(sim);
  });
  await collectEvidence(page);
  await page.keyboard.press('KeyQ');
  await expect.poll(() => page.evaluate(() => (window as TestWindow).ruenCombatEvidence.renders.some(sample => sample.combat.state === 'block')),
    { timeout: 45000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as TestWindow).__veylun.locomotion.diagnostics.combat.state)).toBe('shield');
  const before = await page.evaluate(() => {
    const p = (window as TestWindow).__veylun.sim.player; return { x: p.x, z: p.z };
  });
  await page.keyboard.down('KeyD');
  await expect.poll(() => page.evaluate(before => {
    const { sim, locomotion } = (window as TestWindow).__veylun;
    return locomotion.diagnostics.combat.guardMoving && Math.hypot(sim.player.x - before.x, sim.player.z - before.z) > .03;
  }, before)).toBe(true);
  await page.keyboard.up('KeyD');
  const after = await page.evaluate(() => {
    const p = (window as TestWindow).__veylun.sim.player; return { x: p.x, z: p.z };
  });
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(.01);
  const evidence = await saveEvidence(page, info, 'equipped-guard-block', errors);
  await page.keyboard.up('KeyK');
  await expect.poll(() => page.evaluate(() => (window as TestWindow).__veylun.locomotion.diagnostics.weights.idle)).toBe(1);
  expect(evidence.steps.some(step => step.events.some(event => event.type === 'shield'))).toBe(true);
  expect(evidence.steps.every(step => step.health === 10)).toBe(true);
  const blocks = evidence.renders.filter(sample => sample.combat.state === 'block');
  expect(blocks.length).toBeGreaterThan(0);
  expect(blocks.every(sample => sample.combat.clip === 'Ruen_Block_Equipped')).toBe(true);
  const moving = evidence.renders.filter(sample => sample.combat.guardMoving);
  expect(moving.some(sample => sample.target === 'sprout-1')).toBe(true);
  for (const sample of evidence.renders.filter(sample => sample.combat.state)) expectEquipped(sample);
});

test('attack pause preserves the exact frame, dodge keeps equipment, and enemy damage uses the safe fallback', async ({ page }, info) => {
  const errors = collectErrors(page);
  await startTrial(page);
  await page.evaluate(() => {
    const camera = (window as TestWindow).__veylun.camera;
    camera.yaw = Math.PI; camera.pitch = .12;
  });
  await collectEvidence(page);
  // Pause through the normal Escape input as the first attack enters its active
  // window; no test writes the simulation clock or an animation frame.
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const w = window as TestWindow, deadline = performance.now() + 30000;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ', bubbles: true }));
    function frame(): void {
      const p = w.__veylun.sim.player;
      if (p.attackTime >= .16) {
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyJ', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape', bubbles: true }));
        resolve(); return;
      }
      if (performance.now() > deadline) { reject(new Error('Attack did not enter its active window')); return; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }));
  await expect(page.getByRole('heading', { name: 'Pausa' })).toBeVisible();
  const paused = () => page.evaluate(() => {
    const { sim, locomotion } = (window as TestWindow).__veylun;
    const group = locomotion.model!.container.animationGroups.find(group => group.name === locomotion.diagnostics.combat.clip)!;
    return { age: sim.age, attackTime: sim.player.attackTime, frame: locomotion.diagnostics.combat.frame,
      group: { frame: group.getCurrentFrame(), playing: group.isPlaying, started: group.isStarted },
      rotations: locomotion.model!.container.transformNodes.map(node => node.rotationQuaternion?.asArray()) };
  });
  const frozen = await paused();
  expect(frozen.attackTime).toBeGreaterThanOrEqual(.16);
  expect(frozen.attackTime).toBeLessThan(attacks[0].activeEnd);
  expect(frozen.frame).toBeCloseTo(frozen.attackTime * 60, 5);
  expect(frozen.group.frame).toBeCloseTo(frozen.attackTime * 60, 5);
  expect(frozen.group.playing).toBe(false);
  expect(frozen.group.started).toBe(true);
  await page.waitForTimeout(300);
  expect(await paused()).toEqual(frozen);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as TestWindow).__veylun.sim.player.state)).toBe('idle');

  // Hold guard while a normal dodge press interrupts another attack. Guard must
  // be restored when the equipped roll finishes; it must not retain an attack pose.
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const w = window as TestWindow, deadline = performance.now() + 30000;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ', bubbles: true }));
    function frame(): void {
      if (w.__veylun.sim.player.attackTime > .05) {
        for (const [type, code] of [['keyup', 'KeyJ'], ['keydown', 'KeyK'], ['keydown', 'ShiftLeft'], ['keyup', 'ShiftLeft']]) {
          window.dispatchEvent(new KeyboardEvent(type!, { code: code!, bubbles: true }));
        }
        resolve(); return;
      }
      if (performance.now() > deadline) { reject(new Error('Attack did not start before dodge')); return; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }));
  await expect.poll(() => page.evaluate(() => (window as TestWindow).ruenCombatEvidence.renders.some(sample => sample.state === 'roll'))).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as TestWindow).__veylun.locomotion.diagnostics.combat.state), { timeout: 15000 }).toBe('shield');
  await page.keyboard.up('KeyK');

  // A real Brote charges from behind while Ruen attacks forward. Its normal AI
  // and contact damage interrupt the attack; no direct receiveDamage call is used.
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const w = window as TestWindow, { sim, camera } = w.__veylun;
    Object.assign(sim.player, { x: -2, z: 26, y: 0, yaw: 0, vx: 0, vz: 0 });
    Object.assign(sim.enemies[0]!, { x: -2, z: 24.3, y: 0, state: 'chase', timer: 0, yaw: 0 });
    camera.reset(sim);
    const deadline = performance.now() + 45000;
    let attacked = false;
    function frame(): void {
      const game = w.__veylun.sim, enemy = game.enemies[0]!;
      if (!attacked && enemy.state === 'windup' && enemy.timer >= .6) {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ', bubbles: true }));
        attacked = true;
      }
      if (attacked && game.player.attackTime >= 0) {
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyJ', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK', bubbles: true }));
      }
      if (attacked && game.player.state === 'hurt') { resolve(); return; }
      if (performance.now() > deadline) { reject(new Error(`Brote did not interrupt attack: ${enemy.state}/${game.player.state}`)); return; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }));
  await expect.poll(() => page.evaluate(() => (window as TestWindow).__veylun.locomotion.diagnostics.combat.state), { timeout: 15000 }).toBe('shield');
  await page.keyboard.up('KeyK');
  const evidence = await saveEvidence(page, info, 'equipped-combat-interruptions', errors);
  for (const state of ['roll', 'hurt']) {
    const samples = evidence.renders.filter(sample => sample.state === state);
    expect(samples.length).toBeGreaterThan(0);
    for (const sample of samples) {
      expect(sample.combat.state).toBeNull();
      expect(sample.attackTime).toBe(-1);
      expect(sample.combo).toBe(0);
      if (state === 'roll') {
        expectEquipped(sample);
        expect(sample.traversal.state).toBe('roll');
        expect(sample.traversal.clip).toBe('Ruen_Roll_Equipped');
      } else {
        expect(sample.representation).toBe('fallback');
        expect(sample.traversal.state).toBeNull();
        expect(sample.gear.every(item => !item.enabled)).toBe(true);
      }
    }
  }
  const hurt = evidence.steps.find(step => step.events.some(event => event.type === 'hurt'))!;
  expect(hurt.health).toBe(9);
  expect(hurt.queued).toBe(false);
  expect(evidence.steps.some(step => step.events.some(event => event.type === 'hit'))).toBe(false);
  const previousAttack = evidence.steps.filter(step => step.age < hurt.age && step.combo === 1).at(-1)!;
  expect(hurt.age - previousAttack.age).toBeLessThan(.05);
  expect(evidence.renders.some(sample => sample.health === 9 && sample.combat.state === 'shield' && sample.gear.every(item => item.enabled))).toBe(true);
});
