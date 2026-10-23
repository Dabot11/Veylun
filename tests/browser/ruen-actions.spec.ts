import { expect, test, type Page } from '@playwright/test';
import { SAVE_KEY } from '../../src/progression/save';
import { groundHeight } from '../../src/world/level';
import { attacks } from '../../src/player/combat';
import { actionSample, equipped, idle, observe, pauseDuring, saveEvidence, start, type ActionWindow } from './ruen-actions-harness';

test.use({ baseURL: 'http://127.0.0.1:5174', viewport: { width: 800, height: 600 } });
test.setTimeout(360000);

async function place(page: Page, x: number, z: number, yaw = 0) {
  await page.evaluate(({ x, z, y, yaw }) => {
    const { sim, camera } = (window as unknown as ActionWindow).__veylun;
    Object.assign(sim.player, { x, y, z, yaw, vx: 0, vz: 0, vy: 0 });
    camera.reset(sim);
  }, { x, z, y: groundHeight(x, z), yaw });
}

test('real enemy hits animate hurt and death, pause exactly, and respawn with saved progress', async ({ page }, info) => {
  const errors = await start(page);
  // A two-health encounter is the initial fixture. Normal Brote AI/contact
  // must produce both reactions; the test never calls receiveDamage or respawn.
  await place(page, -2, 26, Math.PI);
  await page.evaluate(() => {
    const { sim, camera } = (window as unknown as ActionWindow).__veylun;
    sim.player.health = 2; camera.yaw = Math.PI * .7; camera.pitch = .12;
    // Initial recovery gives observers time to attach; the normal AI advances
    // through chase/windup/contact, including in the independent physics replay.
    Object.assign(sim.enemies[0]!, { state: 'recover', timer: -1.5 });
  });
  await observe(page);
  await pauseDuring(page, 'hurt', .05);
  await pauseDuring(page, 'death', .2);
  await expect.poll(() => page.evaluate(() => {
    const { sim } = (window as unknown as ActionWindow).__veylun;
    return sim.mode === 'playing' && sim.player.health === 10 && sim.player.z === 0 && sim.save.deaths === 1;
  }), { timeout: 45000 }).toBe(true);
  await idle(page);
  const evidence = await saveEvidence(page, info, 'equipped-hurt-death', errors);
  for (const role of ['hurt', 'death'] as const) {
    const samples = evidence.renders.filter(sample => sample.actions.state === role);
    expect(samples.length).toBeGreaterThan(1); samples.forEach(sample => actionSample(sample, role));
  }
  expect(evidence.steps.filter(step => step.events.some(event => event.type === 'hurt')).map(step => step.player.health)).toEqual([1, 0]);
  expect(evidence.steps.filter(step => step.events.some(event => event.type === 'death'))).toHaveLength(1);
  expect(evidence.steps.filter(step => step.events.some(event => event.type === 'respawn'))).toHaveLength(1);
  expect(evidence.renders.some(sample => sample.mode === 'dead' && sample.modeTime > 1.25 && sample.actions.frame === 75)).toBe(true);
  await page.reload();
  await expect(page.locator('#ruen-model-status')).toHaveAttribute('data-equipment-status', 'ready', { timeout: 150000 });
  await page.getByRole('button', { name: 'Continuar aventura', exact: true }).click();
  await idle(page);
  expect(await page.evaluate(() => {
    const { sim, locomotion } = (window as unknown as ActionWindow).__veylun;
    return { deaths: sim.save.deaths, health: sim.player.health, checkpoint: sim.save.checkpoint,
      representation: locomotion.diagnostics.representation, action: locomotion.diagnostics.actions.state };
  })).toEqual({ deaths: 1, health: 10, checkpoint: 'start', representation: 'meshy', action: null });
  expect(errors).toEqual([]);
});

test('normal E interactions keep equipment through switch, chest and door, then reload the earned key and checkpoint', async ({ page }, info) => {
  const errors = await start(page, 'ruins');
  for (const [label, x, z, event] of [['switch', -4, 59, 'switch'], ['chest', 10, 60, 'chest'], ['door', 0, 87.5, 'door']] as const) {
    await place(page, x, z);
    await observe(page);
    // The real E edge selects the nearby interaction and starts its .5s clock.
    await page.keyboard.press('KeyE');
    await expect.poll(() => page.evaluate(type => (window as unknown as ActionWindow).ruenActionEvidence.steps
      .some(step => step.input.interact && step.events.some(event => event.type === type)), event)).toBe(true);
    await idle(page);
    const evidence = await saveEvidence(page, info, `equipped-interact-${label}`, errors);
    const samples = evidence.renders.filter(sample => sample.actions.state === 'interact');
    expect(samples.length).toBeGreaterThan(1); samples.forEach(sample => actionSample(sample, 'interact'));
    expect(evidence.steps.filter(step => step.events.some(item => item.type === event))).toHaveLength(1);
    expect(evidence.steps.filter(step => step.input.interact)).toHaveLength(1);
    expect(evidence.steps.some(step => step.events.some(item => ['hurt', 'hit', 'death'].includes(item.type)))).toBe(false);
  }
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
  expect(saved).toMatchObject({ switchActivated: true, grateOpened: true, chestOpened: true, hasKey: true,
    doorUnlocked: true, checkpoint: 'before-guardian', completed: false });
  await page.reload();
  await expect(page.locator('#ruen-model-status')).toHaveAttribute('data-equipment-status', 'ready', { timeout: 150000 });
  await page.getByRole('button', { name: 'Continuar aventura', exact: true }).click();
  await idle(page);
  expect(await page.evaluate(() => {
    const sim = (window as unknown as ActionWindow).__veylun.sim;
    return { key: sim.save.hasKey, checkpoint: sim.save.checkpoint, z: sim.player.z, health: sim.player.health };
  })).toEqual({ key: true, checkpoint: 'before-guardian', z: 85, health: 10 });
  expect(errors).toEqual([]);
});

test('altar input pauses and resumes the equipped restoration, renders its exact final pose, and reloads completed victory', async ({ page }, info) => {
  const errors = await start(page, 'altar');
  await place(page, 0, 125);
  await observe(page);
  await page.keyboard.press('KeyE');
  await pauseDuring(page, 'victory', .5);
  await expect(page.getByRole('heading', { name: 'Santuario restaurado' })).toBeVisible({ timeout: 60000 });
  const evidence = await saveEvidence(page, info, 'equipped-restoration', errors);
  const samples = evidence.renders.filter(sample => sample.actions.state === 'victory');
  expect(samples.length).toBeGreaterThan(10); samples.forEach(sample => actionSample(sample, 'victory'));
  expect(evidence.steps.filter(step => step.events.some(event => event.type === 'restore'))).toHaveLength(1);
  expect(evidence.steps.filter(step => step.events.some(event => event.type === 'victory'))).toHaveLength(1);
  const final = samples.at(-1)!;
  expect(final.mode).toBe('won'); expect(final.actions.frame).toBe(180); expect(final.actions.phase).toBe(1);
  const snapshot = () => page.evaluate(() => {
    const { sim, locomotion } = (window as unknown as ActionWindow).__veylun;
    return { age: sim.age, state: sim.player.state, mode: sim.mode, actions: locomotion.diagnostics.actions,
      frame: locomotion.model!.container.animationGroups.find(group => group.name === 'Ruen_Victory_Equipped')!.getCurrentFrame(),
      pose: locomotion.model!.container.transformNodes.map(node => [node.position.asArray(), node.rotationQuaternion?.asArray()]) };
  });
  const before = await snapshot(); await page.waitForTimeout(300); expect(await snapshot()).toEqual(before);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).completed, SAVE_KEY)).toBe(true);
  await page.reload();
  await expect(page.locator('#ruen-model-status')).toHaveAttribute('data-equipment-status', 'ready', { timeout: 150000 });
  await page.getByRole('button', { name: 'Continuar aventura', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Santuario restaurado' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as ActionWindow).__veylun.locomotion.diagnostics.actions.frame)).toBe(180);
  const reloaded = await snapshot();
  expect(reloaded.state).toBe('idle'); expect(reloaded.mode).toBe('won');
  expect(reloaded.actions).toMatchObject({ state: 'victory', time: 3, frame: 180, phase: 1 });
  expect(reloaded.frame).toBe(180); expect(reloaded.pose).toEqual(before.pose);
  expect(await page.evaluate(() => (window as unknown as ActionWindow).__veylun.locomotion.equipment!.models.every(item => item.mount.isEnabled()))).toBe(true);
  expect(errors).toEqual([]);
});

test('real gamepad walking and running stay equipped to both sides and backward under lock-on', async ({ page }, info) => {
  const errors = await start(page, 'fresh', true);
  await place(page, -2, 21);
  await page.evaluate(() => { Object.assign((window as unknown as ActionWindow).__veylun.sim.enemies[0]!, { state: 'recover', timer: -100 }); });
  await observe(page);
  await page.keyboard.press('KeyQ');
  await expect.poll(() => page.evaluate(() => (window as unknown as ActionWindow).__veylun.sim.targetId)).toBe('sprout-1');
  const segments: { gait: 'walk' | 'run'; direction: 'left' | 'right' | 'back'; start: number; end: number }[] = [];
  for (const gait of ['walk', 'run'] as const) for (const direction of ['left', 'right', 'back'] as const) {
    const segment = await page.evaluate(({ gait, direction }) => new Promise<{ start: number; end: number }>((resolve, reject) => {
      const w = window as unknown as ActionWindow, sim = w.__veylun.sim, start = sim.age, deadline = performance.now() + 45000;
      const value = gait === 'walk' ? .4 : 1;
      w.ruenActionPad.axes[0] = direction === 'left' ? -value : direction === 'right' ? value : 0;
      w.ruenActionPad.axes[1] = direction === 'back' ? value : 0;
      const frame = () => {
        if (sim.age - start > .7) { w.ruenActionPad.axes[0] = 0; w.ruenActionPad.axes[1] = 0; resolve({ start, end: sim.age }); return; }
        if (performance.now() > deadline) { reject(new Error(`Directional ${gait}/${direction} did not advance`)); return; }
        requestAnimationFrame(frame);
      }; requestAnimationFrame(frame);
    }), { gait, direction });
    segments.push({ gait, direction, ...segment });
    await idle(page);
  }
  const evidence = await saveEvidence(page, info, 'equipped-directional', errors);
  for (const segment of segments) {
    const samples = evidence.renders.filter(sample => sample.age > segment.start + .2 && sample.age <= segment.end && sample.directional.state === segment.gait);
    expect(samples.length).toBeGreaterThan(1);
    const name = `Ruen_${segment.gait === 'walk' ? 'Walk' : 'Run'}_${segment.direction[0]!.toUpperCase()}${segment.direction.slice(1)}_Equipped`;
    expect(samples.some(sample => sample.clips.some(clip => clip.name === name && clip.weight > .5))).toBe(true);
    for (const sample of samples) {
      equipped(sample); expect(sample.target).toBe('sprout-1'); expect(sample.directional.error).toBeNull();
      expect(Object.values(sample.directional.weights).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
      expect(sample.directional.weights[segment.direction]).toBeGreaterThan(.5);
      expect(sample.clips.filter(clip => clip.weight > 0).every(clip => !clip.playing)).toBe(true);
    }
    const first = samples[0]!.player, last = samples.at(-1)!.player;
    expect(Math.hypot(last.x - first.x, last.z - first.z)).toBeGreaterThan(.1);
  }
  expect(evidence.steps.every(step => step.player.health === 10)).toBe(true);
  expect(evidence.steps.some(step => step.events.some(event => ['hit', 'hurt', 'sword', 'shield'].includes(event.type)))).toBe(false);
});

test('Space permits the existing aerial sword attack and a real airborne shield block without changing damage rules', async ({ page }, info) => {
  const errors = await start(page);
  await observe(page);
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const w = window as unknown as ActionWindow, sim = w.__veylun.sim, deadline = performance.now() + 45000;
    const key = (code: string, down: boolean) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
    key('Space', true); let attacked = false;
    const frame = () => {
      if (!attacked && !sim.player.grounded && sim.player.vy > 0) { key('Space', false); key('KeyJ', true); attacked = true; }
      if (attacked && sim.player.attackTime >= 0) key('KeyJ', false);
      if (attacked && sim.player.state === 'idle' && sim.player.grounded) { resolve(); return; }
      if (performance.now() > deadline) { reject(new Error('Actual Space/J sequence did not finish')); return; }
      requestAnimationFrame(frame);
    }; requestAnimationFrame(frame);
  }));
  await idle(page);
  const attack = await saveEvidence(page, info, 'equipped-air-attack', errors);
  const airborne = attack.renders.filter(sample => sample.combat.airborne && sample.combat.state === 'attack1');
  expect(airborne.length).toBeGreaterThan(1);
  expect(airborne.some(sample => sample.combat.phase === 'active')).toBe(true);
  for (const sample of airborne) {
    equipped(sample); expect(sample.player.grounded).toBe(false);
    expect(sample.combat.clip).toBe('Ruen_Attack1_Equipped');
    expect(sample.combat.frame).toBeCloseTo(sample.player.attackTime * 60, 5);
    expect(sample.clips.find(clip => clip.name === sample.combat.clip)!.frame).toBeCloseTo(sample.player.attackTime * 60, 5);
    expect(sample.combat.phase).toBe(sample.player.attackTime < attacks[0].windup ? 'windup' : sample.player.attackTime < attacks[0].activeEnd ? 'active' : 'recovery');
  }
  expect(attack.steps.filter(step => step.input.attack)).toHaveLength(1);
  expect(attack.steps.some(step => step.events.some(event => event.type === 'hit'))).toBe(false);

  await place(page, -2, 26);
  await page.evaluate(() => {
    // Wait in ordinary recovery while the observer and input driver attach.
    // No AI/controller writes occur after the replay snapshot is taken.
    Object.assign((window as unknown as ActionWindow).__veylun.sim.enemies[0]!, { x: -2, z: 28, state: 'recover', timer: -1.5, hit: false });
  });
  await observe(page);
  await page.keyboard.press('KeyQ');
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const w = window as unknown as ActionWindow, sim = w.__veylun.sim, deadline = performance.now() + 90000;
    const key = (code: string, down: boolean) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
    let jumped = false;
    const frame = () => {
      // React to the actual Brote charge. Space and guard reach InputManager
      // together before contact; the collision and shield event remain real.
      if (!jumped && sim.enemies[0]!.state === 'attack') { key('KeyK', true); key('Space', true); jumped = true; }
      if (jumped && !sim.player.grounded) key('Space', false);
      const blocked = w.ruenActionEvidence.steps.some(step => !step.player.grounded && step.events.some(event => event.type === 'shield'));
      if (blocked && sim.player.grounded && sim.player.state === 'shield') { resolve(); return; }
      if (performance.now() > deadline) { key('KeyK', false); key('Space', false); reject(new Error(`No airborne shield contact: ${sim.player.state}/${sim.player.health}`)); return; }
      requestAnimationFrame(frame);
    }; requestAnimationFrame(frame);
  }));
  const block = await saveEvidence(page, info, 'equipped-air-block', errors);
  await page.keyboard.up('KeyK');
  expect(block.steps.some(step => !step.player.grounded && step.events.some(event => event.type === 'shield'))).toBe(true);
  expect(block.steps.every(step => step.player.health === 10)).toBe(true);
  const guarded = block.renders.filter(sample => sample.combat.airborne);
  expect(guarded.some(sample => sample.combat.state === 'block')).toBe(true);
  expect(guarded.some(sample => sample.combat.state === 'shield')).toBe(true);
  guarded.forEach(equipped);
  const landings = block.renders.filter(sample => sample.player.state === 'land');
  expect(landings.length).toBeGreaterThan(0);
  for (const sample of landings) {
    equipped(sample);
    expect(sample.combat.lowerBody?.state).toBe('land');
    expect(sample.combat.lowerBody?.frame).toBeCloseTo(sample.player.stateTime * 60, 5);
    expect(sample.traversal.state).toBeNull();
  }
  expect(block.steps.some(step => step.events.some(event => ['hurt', 'hit'].includes(event.type)))).toBe(false);
});
