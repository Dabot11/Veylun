import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { Simulation, type Commands, type Player } from '../../src/core/Simulation';
import type { FollowCamera } from '../../src/camera/FollowCamera';
import type { RuenLocomotionView } from '../../src/assets/RuenLocomotionView';
import { gameConfig } from '../../src/config/gameConfig';

test.use({ baseURL: 'http://127.0.0.1:5174', viewport: { width: 800, height: 600 } });
test.setTimeout(300000);

type Role = 'jump' | 'fall' | 'land' | 'roll';
type Traversal = RuenLocomotionView['diagnostics']['traversal'];
type Controller = Pick<Player, 'x' | 'y' | 'z' | 'vx' | 'vy' | 'vz' | 'yaw' | 'state' | 'stateTime' | 'grounded' |
  'health' | 'attackTime' | 'combo' | 'rollCooldown' | 'rollX' | 'rollZ'>;
interface StepSample { dt: number; input: Commands; age: number; player: Controller; events: string[] }
interface RenderSample {
  age: number; player: Controller; target: string | null; traversal: Traversal; representation: string;
  combat: string | null; weights: number[]; rootError: number; rootYaw: number; originalPlaying: string[];
  group: { frame: number; playing: boolean; weight: number } | null;
  gear: { kind: string; enabled: boolean; parent: string | undefined; gripError: number; scale: number[] }[];
}
interface Evidence {
  initial: { serialized: string; hitIds: string[] }; steps: StepSample[]; renders: RenderSample[];
  captures: Record<string, string>; stop: () => void;
}
type TestWindow = Window & {
  __veylun: { sim: Simulation; camera: FollowCamera; locomotion: RuenLocomotionView };
  ruenTraversalEvidence: Evidence;
};
const gravity = -gameConfig.player.gravity;
const launchSpeed = Math.sqrt(2 * gravity * gameConfig.player.jumpHeight);
const duration = { jump: launchSpeed / gravity, fall: .3, land: .12, roll: .45 };
const clips = { jump: 'Ruen_Jump_Equipped', fall: 'Ruen_Fall_Equipped', land: 'Ruen_Land_Equipped', roll: 'Ruen_Roll_Equipped' };

async function startTrial(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('pointer lock')) errors.push(message.text());
  });
  await page.goto('/?test=1');
  await expect(page.locator('#ruen-model-status')).toHaveAttribute('data-equipment-status', 'ready', { timeout: 150000 });
  await page.getByRole('button', { name: 'Nueva partida', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
  await page.getByLabel('Sombras').uncheck();
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  return errors;
}

async function collectEvidence(page: Page, fixture: 'spawn' | 'drop' | 'lock-on' | 'wall') {
  await page.evaluate(fixture => {
    const w = window as unknown as TestWindow, { sim, camera, locomotion } = w.__veylun;
    w.ruenTraversalEvidence?.stop();
    // These are initial placements only. All subsequent motion comes from the
    // normal fixed-step controller, real input, gravity and level collisions.
    if (fixture === 'drop') Object.assign(sim.player, { x: 0, z: 0, y: 2.2, vy: 0, vx: 0, vz: 0,
      state: 'fall', stateTime: 9, grounded: false, coyote: 0 });
    if (fixture === 'lock-on') {
      Object.assign(sim.player, { x: -2, z: 20, y: .12 * Math.sin(20 * .13) * .4, yaw: 0, vx: 0, vz: 0 });
      Object.assign(sim.enemies[0]!, { state: 'recover', timer: -10 });
    }
    if (fixture === 'wall') {
      // The closed sanctuary gate has its near face at z=89.6. The unchanged
      // .28 controller radius must stop the center before z=89.32.
      Object.assign(sim.player, { x: 0, z: 89.1, y: .6, yaw: 0, vx: 0, vz: 0 });
      sim.targetId = null;
    }
    camera.reset(sim);
    if (fixture === 'spawn' || fixture === 'drop') { camera.yaw = Math.PI * .75; camera.pitch = .12; }
    const controller = (p: Player): Controller => ({ x: p.x, y: p.y, z: p.z, vx: p.vx, vy: p.vy, vz: p.vz, yaw: p.yaw,
      state: p.state, stateTime: p.stateTime, grounded: p.grounded, health: p.health, attackTime: p.attackTime,
      combo: p.combo, rollCooldown: p.rollCooldown, rollX: p.rollX, rollZ: p.rollZ });
    const evidence: Evidence = { initial: { serialized: JSON.stringify(sim), hitIds: [...sim.player.hitIds] },
      steps: [], renders: [], captures: {}, stop: () => {} };
    w.ruenTraversalEvidence = evidence;
    const step = sim.step.bind(sim);
    sim.step = (dt, input) => {
      const eventStart = sim.events.length;
      step(dt, input);
      evidence.steps.push({ dt, input: { ...input }, age: sim.age, player: controller(sim.player),
        events: sim.events.slice(eventStart).map(event => event.type) });
    };
    const transform = (point: readonly number[], matrix: ArrayLike<number>) => [
      point[0]! * matrix[0]! + point[1]! * matrix[4]! + point[2]! * matrix[8]! + matrix[12]!,
      point[0]! * matrix[1]! + point[1]! * matrix[5]! + point[2]! * matrix[9]! + matrix[13]!,
      point[0]! * matrix[2]! + point[1]! * matrix[6]! + point[2]! * matrix[10]! + matrix[14]!,
    ];
    const scene = camera.camera.getScene();
    const observer = scene.onAfterRenderObservable.add(() => {
      const model = locomotion.model!, equipment = locomotion.equipment!, d = locomotion.diagnostics, p = sim.player;
      const group = model.container.animationGroups.find(group => group.name === d.traversal.clip);
      const sample: RenderSample = { age: sim.age, player: controller(p), target: sim.targetId, traversal: d.traversal,
        representation: d.representation, combat: d.combat.state, weights: Object.values(d.weights),
        rootError: Math.hypot(model.root.position.x - p.x, model.root.position.y - p.y, model.root.position.z - p.z),
        rootYaw: model.root.rotation.y,
        originalPlaying: model.container.animationGroups.filter(group => group.isPlaying &&
          model.report.animationGroups.some(original => original.name === group.name)).map(group => group.name),
        group: group ? { frame: group.getCurrentFrame(), playing: group.isPlaying, weight: group.weight } : null,
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
      const role = d.traversal.state;
      // Capture real rendered action frames before WebGL discards its buffer.
      if (role && !evidence.captures[role] && d.traversal.entryWeight >= .99 && d.traversal.phase >= .25 && d.traversal.phase <= .85) {
        evidence.captures[role] = scene.getEngine().getRenderingCanvas()!.toDataURL('image/png');
      }
    });
    evidence.stop = () => { scene.onAfterRenderObservable.remove(observer); sim.step = step; };
  }, fixture);
}

async function saveEvidence(page: Page, info: TestInfo, label: string) {
  const evidence = await page.evaluate(() => {
    const evidence = (window as unknown as TestWindow).ruenTraversalEvidence;
    evidence.stop();
    return { initial: evidence.initial, steps: evidence.steps, renders: evidence.renders, captures: evidence.captures };
  });
  for (const [role, dataUrl] of Object.entries(evidence.captures)) {
    const path = info.outputPath(`${label}-${role}.png`);
    await writeFile(path, Buffer.from(dataUrl.split(',')[1]!, 'base64'));
    await info.attach(`${label}-${role}.png`, { path, contentType: 'image/png' });
  }
  const replay = replayController(evidence);
  await info.attach(`${label}.json`, { body: JSON.stringify({ ...evidence, captures: Object.keys(evidence.captures), replay }, null, 2),
    contentType: 'application/json' });
  expect(replay.mismatches).toEqual([]);
  expect(evidence.steps.every(step => step.player.health === 10 && step.player.combo === 0 && step.player.attackTime === -1)).toBe(true);
  expect(evidence.steps.flatMap(step => step.events).filter(type => ['hit', 'hurt', 'sword', 'shield'].includes(type))).toEqual([]);
  return evidence;
}

/** Replay recorded controls with no renderer. This checks that attaching visual
 * traversal leaves every recorded controller position, velocity and clock intact. */
function replayController(evidence: Pick<Evidence, 'initial' | 'steps'>) {
  const initial = JSON.parse(evidence.initial.serialized) as Simulation;
  const controller = new Simulation(initial.save);
  Object.assign(controller, initial);
  controller.player.hitIds = new Set(evidence.initial.hitIds);
  const mismatches: string[] = [];
  let maxNumericDelta = 0;
  for (const [index, sample] of evidence.steps.entries()) {
    controller.events.length = 0;
    controller.step(sample.dt, sample.input);
    const ageDelta = Math.abs(sample.age - controller.age);
    maxNumericDelta = Math.max(maxNumericDelta, ageDelta);
    if (ageDelta > 1e-8 && mismatches.length < 10) mismatches.push(`step ${index} age: ${sample.age} != ${controller.age}`);
    for (const key of Object.keys(sample.player) as (keyof Controller)[]) {
      const expected = controller.player[key], actual = sample.player[key];
      if (typeof actual === 'number' && typeof expected === 'number') {
        const delta = Math.abs(actual - expected);
        maxNumericDelta = Math.max(maxNumericDelta, delta);
        if (delta > 1e-8 && mismatches.length < 10) mismatches.push(`step ${index} ${key}: ${actual} != ${expected}`);
      } else if (actual !== expected && mismatches.length < 10) mismatches.push(`step ${index} ${key}: ${actual} != ${expected}`);
    }
  }
  return { steps: evidence.steps.length, maxNumericDelta, mismatches };
}

function expectTraversal(sample: RenderSample) {
  const role = sample.player.state as Role, p = sample.player, d = sample.traversal;
  const time = Math.max(0, Math.min(duration[role], role === 'jump' ? (launchSpeed - p.vy) / gravity : role === 'fall' ? -p.vy / gravity : p.stateTime));
  expect(sample.representation).toBe('meshy');
  expect(d.state).toBe(role);
  expect(d.clip).toBe(clips[role]);
  expect(d.error).toBeNull();
  expect(d.time).toBeCloseTo(time, 7);
  expect(d.frame).toBeCloseTo(time * 60, 5);
  expect(d.phase).toBeCloseTo(time / duration[role], 6);
  expect(sample.group).toMatchObject({ playing: false, weight: 1 });
  expect(sample.group!.frame).toBeCloseTo(time * 60, 5);
  expect(sample.weights).toEqual([0, 0, 0]);
  expect(sample.combat).toBeNull();
  expect(sample.rootError).toBeLessThan(.00001);
  expect(sample.rootYaw).toBeCloseTo(p.yaw, 8);
  expect(sample.originalPlaying).toEqual([]);
  expect(sample.gear).toHaveLength(2);
  for (const item of sample.gear) {
    expect(item.enabled).toBe(true);
    expect(item.parent).toBe(item.kind === 'sword' ? 'mixamorig:RightHand' : 'mixamorig:LeftHand');
    // Float32 world/inverse matrices accumulate a few micrometres at level coordinates.
    expect(item.gripError).toBeLessThan(.0001);
    item.scale.forEach(scale => expect(scale).toBeCloseTo(item.kind === 'sword' ? .55 : .294, 8));
  }
}

async function act(page: Page, action: 'jump-pause' | 'roll-pause' | 'wall-roll') {
  await page.evaluate(action => new Promise<void>((resolve, reject) => {
    const { sim } = (window as unknown as TestWindow).__veylun, deadline = performance.now() + 45000;
    const key = (code: string, down: boolean) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
    const role = action === 'jump-pause' ? 'jump' : 'roll';
    if (action !== 'jump-pause') key(action === 'wall-roll' ? 'KeyW' : 'KeyD', true);
    key(role === 'jump' ? 'Space' : 'ShiftLeft', true);
    let started = false;
    function frame(): void {
      const p = sim.player;
      if (p.state === role) {
        started = true;
        key(role === 'jump' ? 'Space' : 'ShiftLeft', false);
        key('KeyD', false); key('KeyW', false);
        if (action !== 'wall-roll' && p.stateTime >= .13) {
          key('Escape', true); key('Escape', false); resolve(); return;
        }
      } else if (started && action === 'wall-roll' && p.state === 'idle') { resolve(); return; }
      if (performance.now() > deadline) { reject(new Error(`${action} did not complete: ${p.state}/${p.stateTime}`)); return; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }), action);
}

async function assertPaused(page: Page, role: 'jump' | 'roll') {
  await expect(page.getByRole('heading', { name: 'Pausa' })).toBeVisible();
  const snapshot = () => page.evaluate(() => {
    const { sim, locomotion } = (window as unknown as TestWindow).__veylun, d = locomotion.diagnostics;
    return { age: sim.age, player: { y: sim.player.y, vy: sim.player.vy, stateTime: sim.player.stateTime }, traversal: d.traversal,
      group: d.clips.find(clip => clip.name === d.traversal.clip),
      pose: locomotion.model!.container.transformNodes.map(node => [node.position.asArray(), node.rotationQuaternion?.asArray()]) };
  });
  const before = await snapshot();
  expect(before.traversal.state).toBe(role);
  expect(before.group?.isPlaying).toBe(false);
  await page.waitForTimeout(300);
  expect(await snapshot()).toEqual(before);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
}

async function awaitIdle(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const { sim, locomotion } = (window as unknown as TestWindow).__veylun;
    return sim.player.state === 'idle' && sim.player.grounded && locomotion.diagnostics.weights.idle === 1 &&
      locomotion.diagnostics.traversal.state === null && locomotion.diagnostics.equipment?.enabled;
  }), { timeout: 30000 }).toBe(true);
}

test('Space keeps equipped jump, fall and landing on the physics clock, including pause and an unlaunched drop', async ({ page }, info) => {
  const errors = await startTrial(page);
  await collectEvidence(page, 'spawn');
  await act(page, 'jump-pause');
  await assertPaused(page, 'jump');
  await awaitIdle(page);
  const jump = await saveEvidence(page, info, 'equipped-jump');
  for (const role of ['jump', 'fall', 'land'] as const) {
    const samples = jump.renders.filter(sample => sample.player.state === role);
    expect(samples.length).toBeGreaterThan(0);
    samples.forEach(expectTraversal);
  }
  expect(jump.steps.filter(step => step.input.jump)).toHaveLength(1);
  const height = Math.max(...jump.steps.map(step => step.player.y));
  expect(height).toBeGreaterThan(1.2);
  expect(height).toBeLessThan(gameConfig.player.jumpHeight);
  const firstFall = jump.renders.find(sample => sample.player.state === 'fall')!;
  expect(firstFall.player.stateTime).toBeGreaterThan(.3);
  expect(firstFall.traversal.time).toBeLessThan(.15);
  expect(jump.captures.jump).toMatch(/^data:image\/png;base64,/);

  // Falling from an initial height has no jump impulse. An old stateTime must
  // not seek the Fall clip immediately to its end or restart a Jump animation.
  await collectEvidence(page, 'drop');
  await awaitIdle(page);
  const drop = await saveEvidence(page, info, 'equipped-drop');
  const falling = drop.renders.filter(sample => sample.player.state === 'fall');
  expect(falling.length).toBeGreaterThan(1);
  falling.forEach(expectTraversal);
  expect(falling[0]!.player.stateTime).toBeGreaterThan(9);
  expect(falling[0]!.traversal.time).toBeLessThan(.15);
  expect(drop.steps.some(step => step.player.state === 'jump' || step.input.jump)).toBe(false);
  expect(drop.renders.some(sample => sample.player.state === 'land')).toBe(true);
  await info.attach('traversal-jump-console.json', { body: JSON.stringify(errors), contentType: 'application/json' });
  expect(errors).toEqual([]);
});

test('Shift rolls along its committed direction under lock-on, freezes in pause, and respects the level wall', async ({ page }, info) => {
  const errors = await startTrial(page);
  await collectEvidence(page, 'lock-on');
  await page.keyboard.press('KeyQ');
  await expect.poll(() => page.evaluate(() => (window as unknown as TestWindow).__veylun.sim.targetId)).toBe('sprout-1');
  await act(page, 'roll-pause');
  await assertPaused(page, 'roll');
  await awaitIdle(page);
  const side = await saveEvidence(page, info, 'equipped-roll-lock-on');
  const rolls = side.renders.filter(sample => sample.player.state === 'roll');
  expect(rolls.length).toBeGreaterThan(2);
  for (const sample of rolls) {
    expectTraversal(sample);
    const p = sample.player, angle = Math.atan2(p.rollX, p.rollZ) - p.yaw;
    expect(sample.traversal.direction).toBeCloseTo(Math.atan2(Math.sin(angle), Math.cos(angle)), 7);
    expect(sample.target).toBe('sprout-1');
    expect(Math.hypot(p.vx, p.vz)).toBeCloseTo(8, 7);
  }
  expect(rolls.some(sample => Math.abs(sample.traversal.direction) > Math.PI / 3)).toBe(true);
  expect(side.steps.filter(step => step.input.dodge)).toHaveLength(1);
  expect(side.steps.at(-1)!.player.x - side.steps[0]!.player.x).toBeGreaterThan(3);
  expect(side.captures.roll).toMatch(/^data:image\/png;base64,/);

  await collectEvidence(page, 'wall');
  // The cooldown is controller-owned; wait rather than resetting it in the fixture.
  await expect.poll(() => page.evaluate(() => (window as unknown as TestWindow).__veylun.sim.player.rollCooldown)).toBe(0);
  await act(page, 'wall-roll');
  await awaitIdle(page);
  const wall = await saveEvidence(page, info, 'equipped-roll-wall');
  const stoppedZ = wall.steps.at(-1)!.player.z;
  expect(stoppedZ).toBeGreaterThan(89.1);
  expect(stoppedZ).toBeLessThanOrEqual(89.32);
  const wallRolls = wall.renders.filter(sample => sample.player.state === 'roll');
  wallRolls.forEach(expectTraversal);
  // The full-speed roll stops one swept substep before the wall. Its later
  // decelerating Idle can approach slightly closer, so compare adjacent roll
  // frames: movement is blocked even while the controller still requests 8m/s.
  const blocked = wallRolls.filter((sample, index) => index > 0 && sample.player.vz > 7.99 &&
    Math.abs(sample.player.z - wallRolls[index - 1]!.player.z) < 1e-9);
  expect(blocked.length).toBeGreaterThan(1);
  expect(blocked.at(-1)!.traversal.frame).toBeGreaterThan(blocked[0]!.traversal.frame!);
  expect(wall.steps.every(step => step.player.z <= 89.32)).toBe(true);
  await info.attach('traversal-roll-console.json', { body: JSON.stringify(errors), contentType: 'application/json' });
  expect(errors).toEqual([]);
});
