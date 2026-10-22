import { expect, test, type Page } from '@playwright/test';
import type { Simulation } from '../../src/core/Simulation';
import type { FollowCamera } from '../../src/camera/FollowCamera';
import type { RuenLocomotionView } from '../../src/assets/RuenLocomotionView';
import type { InspectionModel } from '../../src/assets/inspectModel';
import type { Scene } from '@babylonjs/core/scene';

// These tests load the unmodified Meshy master, not the synthetic inspector fixture.
test.use({ baseURL: 'http://127.0.0.1:5174', viewport: { width: 800, height: 600 } });
test.setTimeout(180000);
const assetPattern = '**/assets/models/ruen/Meshy_AI_Crimson_Gemwarden_All_Animations.glb';
type TestWindow = Window & {
  __assetInspector: { model: InspectionModel; scene: Scene; camera: { radius: number } };
  __veylun: { sim: Simulation; camera: FollowCamera; locomotion: RuenLocomotionView | undefined };
  meshPad: { axes: number[]; buttons: { pressed: boolean; touched: boolean; value: number }[] };
  meshBlendSamples: { walk: number; run: number; started: string[] }[];
};

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('pointer lock')) errors.push(message.text());
  });
  return errors;
}

async function installPad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const pad = { id: 'Xbox simulated Meshy locomotion QA', index: 0, connected: true, mapping: 'standard', timestamp: 0,
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
    Object.assign(window, { meshPad: pad });
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad] });
  });
}

async function stick(page: Page, forward: number): Promise<void> {
  await page.evaluate(value => { (window as TestWindow).meshPad.axes[1] = -value; }, forward);
}

async function startTrial(page: Page): Promise<void> {
  await page.goto('/?ruen=meshy&test=1');
  await expect(page.locator('body')).toHaveAttribute('data-engine', 'ready', { timeout: 60000 });
  await expect(page.locator('#ruen-model-status')).toHaveAttribute('data-status', 'ready', { timeout: 120000 });
  await page.getByRole('button', { name: 'Nueva partida', exact: true }).click();
  // Normal graphics setting reduces software-renderer cost without replacing gameplay.
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
  await page.getByLabel('Sombras').uncheck();
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
}

async function state(page: Page) {
  return page.evaluate(() => {
    const { sim, locomotion } = (window as TestWindow).__veylun;
    return { state: sim.player.state, grounded: sim.player.grounded, x: sim.player.x, y: sim.player.y, z: sim.player.z,
      vx: sim.player.vx, vz: sim.player.vz, diagnostics: locomotion?.diagnostics };
  });
}

test('real Meshy master loads its skin/materials and plays Walking and Running independently in the inspector', async ({ page }, info) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?inspect=ruen&test=1');
  await page.locator('#asset-load-default').click();
  await expect(page.locator('#asset-status')).toHaveAttribute('data-state', 'loaded', { timeout: 120000 });
  const report = await page.evaluate(() => (window as TestWindow).__assetInspector.model.report);
  expect(report.animationGroups).toHaveLength(20);
  expect(report.skeletons).toHaveLength(1);
  expect(report.skeletons[0]?.name).toBe('SmartRigArmature');
  expect(report.skeletons[0]?.bones).toHaveLength(80);
  expect(report.materials.map(material => material.name)).toEqual(['BakedMaterial']);
  expect(report.materials[0]?.textures.map(texture => [texture.width, texture.height])).toEqual([[2048, 2048], [4096, 4096], [2048, 2048]]);
  expect(report.extensionsUsed).toEqual([]);
  expect(report.animationGroups.find(clip => clip.name === 'Walking')?.durationSeconds).toBeCloseTo(1.033333, 4);
  expect(report.animationGroups.find(clip => clip.name === 'Running')?.durationSeconds).toBeCloseTo(.633333, 4);
  const playing = () => page.evaluate(() => (window as TestWindow).__assetInspector.model.container.animationGroups.filter(group => group.isPlaying).map(group => group.name));
  expect(await playing()).toEqual([]);
  for (const clip of ['Walking', 'Running']) {
    await page.locator('#asset-clip').selectOption(clip);
    await expect.poll(playing).toEqual([clip]);
    const pose = () => page.evaluate(() => (window as TestWindow).__assetInspector.model.container.transformNodes.map(node => node.rotationQuaternion?.asArray()));
    const before = await pose();
    await expect.poll(pose).not.toEqual(before);
    await page.locator('#asset-play').click();
    expect(await playing()).toEqual([]);
    for (const view of ['front', 'back']) {
      await page.locator(`#asset-view-${view}`).click();
      await page.locator('#asset-inspector').evaluate(panel => { panel.scrollTop = 0; });
      await page.screenshot({ path: info.outputPath(`meshy-${clip.toLowerCase()}-${view}.png`) });
    }
  }
  await info.attach('real-master-browser-inventory.json', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
  await info.attach('real-master-console.json', { body: JSON.stringify(errors, null, 2), contentType: 'application/json' });
  expect(errors).toEqual([]);
});

test('Meshy trial blends real locomotion and explicitly preserves existing action fallbacks', async ({ page }, info) => {
  const errors = collectErrors(page);
  await installPad(page);
  await startTrial(page);
  await expect.poll(async () => (await state(page)).diagnostics?.representation).toBe('fallback');
  await stick(page, .45);
  await expect.poll(async () => (await state(page)).state).toBe('walk');
  await expect.poll(async () => (await state(page)).diagnostics?.weights.walk).toBeCloseTo(1);
  const walking = await state(page);
  expect(walking.diagnostics?.representation).toBe('meshy');
  expect(walking.diagnostics!.speed).toBeGreaterThan(.2);
  expect(walking.diagnostics!.clips.filter(clip => clip.isPlaying).map(clip => clip.name)).toEqual(['Walking']);

  await page.evaluate(() => {
    const w = window as TestWindow;
    w.meshBlendSamples = [];
    const scene = w.__veylun.camera.camera.getScene();
    const observer = scene.onAfterRenderObservable.add(() => {
      const diagnostics = w.__veylun.locomotion!.diagnostics;
      w.meshBlendSamples.push({ ...diagnostics.weights, started: diagnostics.clips.filter(clip => clip.isStarted).map(clip => clip.name) });
      if (w.meshBlendSamples.length >= 20) scene.onAfterRenderObservable.remove(observer);
    });
  });
  await stick(page, 1);
  await expect.poll(async () => (await state(page)).state).toBe('run');
  await expect.poll(async () => (await state(page)).diagnostics?.weights.run).toBeCloseTo(1);
  const samples = await page.evaluate(() => (window as TestWindow).meshBlendSamples);
  expect(samples.some(sample => sample.walk > 0 && sample.run > 0)).toBe(true);
  for (const sample of samples) {
    expect(sample.walk + sample.run).toBeCloseTo(1);
    expect(sample.started.length).toBeLessThanOrEqual(2);
    expect(sample.started.every(name => name === 'Walking' || name === 'Running')).toBe(true);
  }
  const anchor = await page.evaluate(() => {
    const { sim, camera, locomotion } = (window as TestWindow).__veylun;
    return { root: locomotion!.model!.root.position.asArray(), player: [sim.player.x, sim.player.y, sim.player.z],
      parent: locomotion!.model!.root.parent?.name ?? null, scale: locomotion!.model!.root.scaling.asArray(),
      fallbackEnabled: camera.camera.getScene().getTransformNodeByName('ruen-provisional')!.isEnabled() };
  });
  expect(anchor.root).toEqual(anchor.player);
  expect(anchor.parent).toBeNull();
  expect(anchor.scale).toEqual([1.45 / 1.7, 1.45 / 1.7, 1.45 / 1.7]);
  expect(anchor.fallbackEnabled).toBe(false);
  await page.screenshot({ path: info.outputPath('meshy-gameplay-running.png') });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Pausa' })).toBeVisible();
  await expect.poll(async () => (await state(page)).diagnostics!.clips.filter(clip => clip.isPlaying)).toEqual([]);
  const paused = await state(page);
  expect(paused.diagnostics!.clips.every(clip => !clip.isPlaying)).toBe(true);
  await page.waitForTimeout(300);
  const afterPause = await state(page);
  expect(afterPause.diagnostics!.clips.map(clip => clip.frame)).toEqual(paused.diagnostics!.clips.map(clip => clip.frame));
  await page.screenshot({ path: info.outputPath('meshy-gameplay-paused.png') });
  await stick(page, 0);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect.poll(async () => (await state(page)).state).toBe('idle');

  for (const [key, pattern] of [['Space', /^(jump|fall)$/], ['ShiftLeft', /^roll$/], ['KeyJ', /^attack[123]$/], ['KeyK', /^shield$/]] as const) {
    await page.keyboard.down(key);
    await expect.poll(async () => (await state(page)).state, { intervals: [25, 50, 100] }).toMatch(pattern);
    const action = await state(page);
    expect(action.diagnostics?.representation).toBe('fallback');
    expect(action.diagnostics!.clips.every(clip => !clip.isPlaying)).toBe(true);
    await page.keyboard.up(key);
    await expect.poll(async () => (await state(page)).state, { timeout: 10000 }).toBe('idle');
    await expect.poll(async () => (await state(page)).grounded).toBe(true);
  }
  await info.attach('walking-running-blend-samples.json', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
  await info.attach('gameplay-console.json', { body: JSON.stringify(errors, null, 2), contentType: 'application/json' });
  expect(errors).toEqual([]);
});

test('actual collision displacement freezes Meshy even while the controller requests movement', async ({ page }, info) => {
  const errors = collectErrors(page);
  await startTrial(page);
  // Initial placement only; ordinary input and the existing z=-10 level boundary resolve collision.
  await page.evaluate(() => {
    const { sim, camera } = (window as TestWindow).__veylun;
    Object.assign(sim.player, { x: 0, y: 0, z: -9.8, vx: 0, vz: 0, yaw: Math.PI });
    camera.reset(sim);
  });
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await state(page)).z).toBe(-10);
  await expect.poll(async () => (await state(page)).diagnostics?.speed).toBeCloseTo(0, 8);
  const blocked = await state(page);
  expect(blocked.state).toBe('run');
  expect(blocked.vz).toBeLessThan(-1);
  expect(blocked.diagnostics?.representation).toBe('meshy');
  const frame = blocked.diagnostics!.clips.find(clip => clip.name === 'Running')!.frame;
  await page.waitForTimeout(400);
  const stillBlocked = await state(page);
  expect(stillBlocked.z).toBe(-10);
  expect(stillBlocked.diagnostics!.clips.find(clip => clip.name === 'Running')!.frame).toBeCloseTo(frame, 5);
  const anchor = await page.evaluate(() => {
    const { sim, camera, locomotion } = (window as TestWindow).__veylun;
    const target = camera.camera.getTarget();
    return { x: locomotion!.model!.root.position.x, z: locomotion!.model!.root.position.z,
      targetDistance: Math.hypot(target.x - sim.player.x, target.z - sim.player.z) };
  });
  expect(anchor.x).toBeCloseTo(0);expect(anchor.z).toBe(-10);
  expect(anchor.targetDistance).toBeLessThan(.3);
  await page.keyboard.up('KeyW');
  await info.attach('blocked-locomotion.json', { body: JSON.stringify({ blocked, stillBlocked, anchor }, null, 2), contentType: 'application/json' });
  expect(errors).toEqual([]);
});

test('a failed real model request retains the existing playable Ruen', async ({ page }, info) => {
  const unhandled: string[] = [];
  const consoleMessages: string[] = [];
  page.on('pageerror', error => unhandled.push(error.message));
  page.on('console', message => { if (['warning', 'error'].includes(message.type())) consoleMessages.push(message.text()); });
  await page.route(assetPattern, route => route.abort('failed'));
  await page.goto('/?ruen=meshy&test=1');
  await expect(page.locator('body')).toHaveAttribute('data-engine', 'ready', { timeout: 60000 });
  await expect(page.locator('#ruen-model-status')).toHaveAttribute('data-status', 'error', { timeout: 60000 });
  await page.getByRole('button', { name: 'Nueva partida', exact: true }).click();
  const start = await state(page);
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await state(page)).z).toBeGreaterThan(start.z + .2);
  await page.keyboard.up('KeyW');
  const result = await page.evaluate(() => {
    const { locomotion, camera } = (window as TestWindow).__veylun;
    return { status: locomotion!.status, representation: locomotion!.diagnostics.representation,
      fallbackEnabled: camera.camera.getScene().getTransformNodeByName('ruen-provisional')!.isEnabled() };
  });
  expect(result).toEqual({ status: 'error', representation: 'fallback', fallbackEnabled: true });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Pausa' })).toBeVisible();
  await info.attach('intentional-load-failure.json', { body: JSON.stringify({ unhandled, consoleMessages }, null, 2), contentType: 'application/json' });
  expect(unhandled).toEqual([]);
});
