import { expect, test, type Page } from '@playwright/test';
import type { Simulation } from '../../src/core/Simulation';
import type { FollowCamera } from '../../src/camera/FollowCamera';
import type { RuenLocomotionView } from '../../src/assets/RuenLocomotionView';
import type { InspectionModel } from '../../src/assets/inspectModel';
import type { Scene } from '@babylonjs/core/scene';

// These tests load the unmodified Meshy master, not the synthetic inspector fixture.
test.use({ baseURL: 'http://127.0.0.1:5174', viewport: { width: 800, height: 600 } });
test.setTimeout(240000);
const assetPattern = '**/assets/models/ruen/Meshy_AI_Crimson_Gemwarden_All_Animations.glb';
const equippedNames = { idle: 'Ruen_Idle_Equipped', walk: 'Ruen_Walk_Equipped', run: 'Ruen_Run_Equipped' } as const;
type TestWindow = Window & {
  __assetInspector: { model: InspectionModel; scene: Scene; camera: { radius: number } };
  __veylun: { sim: Simulation; camera: FollowCamera; locomotion: RuenLocomotionView | undefined };
  meshPad: { axes: number[]; buttons: { pressed: boolean; touched: boolean; value: number }[] };
  meshBlendSamples: { idle: number; walk: number; run: number; started: string[] }[];
  meshStopBlend?: () => void;
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

async function startTrial(page: Page, url = '/?test=1'): Promise<void> {
  await page.goto(url);
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
  const modelRequests: string[] = [];
  page.on('request', request => { if (/\.glb(?:\?|$)/.test(request.url())) modelRequests.push(request.url()); });
  await page.goto('/?inspect=ruen&test=1');
  await expect(page.locator('#asset-status')).toHaveAttribute('data-state', 'loaded', { timeout: 120000 });
  expect(modelRequests).toHaveLength(1);
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

/** Read transforms at the last rendered frame without advancing simulation or animation. */
async function equipmentPose(page: Page) {
  return page.evaluate(() => {
    const { sim, locomotion } = (window as TestWindow).__veylun;
    const model = locomotion!.model!, equipment = locomotion!.equipment!;
    const transform = (point: readonly number[], matrix: ArrayLike<number>) => [
      point[0]! * matrix[0]! + point[1]! * matrix[4]! + point[2]! * matrix[8]! + matrix[12]!,
      point[0]! * matrix[1]! + point[1]! * matrix[5]! + point[2]! * matrix[9]! + matrix[13]!,
      point[0]! * matrix[2]! + point[1]! * matrix[6]! + point[2]! * matrix[10]! + matrix[14]!,
    ];
    const rootInverse = model.root.computeWorldMatrix(true).clone().invert();
    return {
      age: sim.age, health: sim.player.health, enemyHealth: sim.enemies.map(enemy => enemy.hp),
      feet: model.container.transformNodes.filter(node => /mixamorig:(Left|Right)(UpLeg|Leg|Foot|ToeBase|Toe_End)$/.test(node.name))
        .map(node => ({ name: node.name, relativeWorld: Array.from(node.computeWorldMatrix(true).multiply(rootInverse).asArray()) })),
      torso: model.container.transformNodes.filter(node => /^mixamorig:Spine[12]$/.test(node.name))
        .map(node => ({ name: node.name, rotation: node.rotationQuaternion!.asArray() })),
      gear: equipment.models.map(item => {
        const profile = equipment.report.items.find(profile => profile.kind === item.kind)!;
        const hand = model.container.transformNodes.find(node => node.name === profile.hand)!;
        const gripWorld = transform(profile.grip, item.model.root.computeWorldMatrix(true).asArray());
        return { kind: item.kind, enabled: item.mount.isEnabled(), parent: item.mount.parent?.name,
          linked: model.container.skeletons[0]!.bones.find(bone => bone.name === profile.hand)!.getTransformNode() === item.mount.parent,
          gripInHand: transform(gripWorld, hand.computeWorldMatrix(true).clone().invert().asArray()),
          expectedGripInHand: [...profile.handOffset], scale: item.mount.scaling.asArray() };
      }),
    };
  });
}

function expectGearAttached(pose: Awaited<ReturnType<typeof equipmentPose>>, enabled = true) {
  expect(pose.gear).toHaveLength(2);
  for (const gear of pose.gear) {
    expect(gear.enabled).toBe(enabled);
    expect(gear.parent).toBe(gear.kind === 'sword' ? 'mixamorig:RightHand' : 'mixamorig:LeftHand');
    expect(gear.linked).toBe(true);
    gear.gripInHand.forEach((value, axis) => expect(value).toBeCloseTo(gear.expectedGripInHand[axis]!, 5));
    gear.scale.forEach(value => expect(value).toBeCloseTo(gear.kind === 'sword' ? .55 : .42 * .7, 10));
  }
}

function expectSameFeet(actual: Awaited<ReturnType<typeof equipmentPose>>, expected: Awaited<ReturnType<typeof equipmentPose>>) {
  expect(actual.feet.map(node => node.name)).toEqual(expected.feet.map(node => node.name));
  actual.feet.forEach((node, index) => node.relativeWorld.forEach((value, axis) =>
    expect(value, `${node.name}[${axis}]`).toBeCloseTo(expected.feet[index]!.relativeWorld[axis]!, 5)));
}

async function originalClipFingerprint(page: Page) {
  return page.evaluate(() => {
    const model = (window as TestWindow).__veylun.locomotion!.model!;
    return model.report.animationGroups.map(original => {
      const group = model.container.animationGroups.find(group => group.name === original.name)!;
      const data = JSON.stringify(group.targetedAnimations.map(({ target, animation }) => ({
        target: target.name, property: animation.targetProperty, fps: animation.framePerSecond,
        keys: animation.getKeys(),
      })));
      let hash = 2166136261;
      for (let index = 0; index < data.length; index++) hash = Math.imul(hash ^ data.charCodeAt(index), 16777619);
      return { name: group.name, from: group.from, to: group.to, tracks: group.targetedAnimations.length, hash: hash >>> 0 };
    });
  });
}

async function collectBlend(page: Page) {
  await page.evaluate(() => {
    const w = window as TestWindow;
    w.meshStopBlend?.();
    const samples: TestWindow['meshBlendSamples'] = [];
    w.meshBlendSamples = samples;
    const scene = w.__veylun.camera.camera.getScene();
    const observer = scene.onAfterRenderObservable.add(() => {
      const diagnostics = w.__veylun.locomotion!.diagnostics;
      samples.push({ ...diagnostics.weights, started: diagnostics.clips.filter(clip => clip.isStarted).map(clip => clip.name) });
      if (samples.length >= 20) scene.onAfterRenderObservable.remove(observer);
    });
    w.meshStopBlend = () => { scene.onAfterRenderObservable.remove(observer); };
  });
}

function expectBlendWeights(samples: TestWindow['meshBlendSamples']) {
  for (const sample of samples) {
    expect(sample.idle + sample.walk + sample.run).toBeCloseTo(1);
    expect(sample.started.length).toBeLessThanOrEqual(3);
    expect(sample.started.every(name => Object.values(equippedNames).includes(name as typeof equippedNames[keyof typeof equippedNames]))).toBe(true);
  }
}

test('default Ruen breathes with reduced equipment, blends walking and running, and preserves action fallbacks', async ({ page }, info) => {
  test.setTimeout(480000);
  const errors = collectErrors(page);
  const requests: string[] = [];
  page.on('request', request => { if (/\.glb(?:\?|$)/.test(request.url())) requests.push(request.url()); });
  await installPad(page);
  await startTrial(page);
  await expect(page.locator('#ruen-model-status')).toHaveAttribute('data-equipment-status', 'ready');
  await expect.poll(async () => (await state(page)).diagnostics?.representation).toBe('meshy');
  await expect.poll(async () => (await state(page)).diagnostics?.weights.idle).toBe(1);
  await expect.poll(async () => (await state(page)).diagnostics?.clips.filter(clip => clip.isPlaying).map(clip => clip.name)).toEqual([equippedNames.idle]);
  expect(requests).toHaveLength(3);
  expect(requests.filter(url => url.includes('/equipment/runtime/'))).toHaveLength(2);
  expect(requests.some(url => /Meshy_AI_(Azure|Aegis)/.test(url))).toBe(false);
  const inventory = await page.evaluate(() => {
    const view = (window as TestWindow).__veylun.locomotion!;
    return { hero: view.model!.report, groups: view.model!.container.animationGroups.map(group => group.name), equipment: view.equipment!.report };
  });
  expect(inventory.hero.animationGroups).toHaveLength(20);
  expect(inventory.groups).toHaveLength(23);
  expect(new Set(inventory.groups).size).toBe(23);
  expect(inventory.equipment.items).toHaveLength(2);
  const triangleCount = inventory.equipment.items.reduce((sum, item) => sum + item.inventory!.meshes.reduce((total, mesh) => total + mesh.triangles, 0), 0);
  expect(triangleCount).toBeGreaterThan(10000);
  expect(triangleCount).toBeLessThanOrEqual(150000);
  for (const item of inventory.equipment.items) {
    expect(item.inventory!.skeletons).toHaveLength(0);
    expect(item.inventory!.animationGroups).toHaveLength(0);
    expect(item.inventory!.materials).toHaveLength(1);
    expect(item.inventory!.materials[0]!.textures).toHaveLength(3);
    expect(item.inventory!.materials[0]!.textures.every(texture => texture.width === 1024 && texture.height === 1024)).toBe(true);
  }
  const originalClips = await originalClipFingerprint(page);
  const standing = await equipmentPose(page);
  expectGearAttached(standing);
  await expect.poll(async () => (await equipmentPose(page)).torso).not.toEqual(standing.torso);
  expectSameFeet(await equipmentPose(page), standing);

  await collectBlend(page);
  await stick(page, .45);
  await expect.poll(async () => (await state(page)).state).toBe('walk');
  await expect.poll(async () => (await state(page)).diagnostics?.weights.walk).toBe(1);
  const walking = await state(page);
  expect(walking.diagnostics?.representation).toBe('meshy');
  expect(walking.diagnostics!.speed).toBeGreaterThan(.2);
  expect(walking.diagnostics!.clips.filter(clip => clip.isPlaying).map(clip => clip.name)).toEqual([equippedNames.walk]);
  expectGearAttached(await equipmentPose(page));
  const idleToWalk = await page.evaluate(() => (window as TestWindow).meshBlendSamples);
  expect(idleToWalk.some(sample => sample.idle > 0 && sample.walk > 0)).toBe(true);
  expectBlendWeights(idleToWalk);

  await collectBlend(page);
  await stick(page, 1);
  await expect.poll(async () => (await state(page)).state).toBe('run');
  await expect.poll(async () => (await state(page)).diagnostics?.weights.run).toBe(1);
  const samples = await page.evaluate(() => (window as TestWindow).meshBlendSamples);
  expect(samples.some(sample => sample.walk > 0 && sample.run > 0)).toBe(true);
  expectBlendWeights(samples);
  expectGearAttached(await equipmentPose(page));
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
  await page.screenshot({ path: info.outputPath('equipped-gameplay-running.png') });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Pausa' })).toBeVisible();
  await expect.poll(async () => (await state(page)).diagnostics!.clips.filter(clip => clip.isPlaying)).toEqual([]);
  const paused = await state(page);
  const pausedGear = await equipmentPose(page);
  expectGearAttached(pausedGear);
  await page.waitForTimeout(300);
  const afterPause = await state(page);
  expect(afterPause.diagnostics!.clips.map(clip => clip.frame)).toEqual(paused.diagnostics!.clips.map(clip => clip.frame));
  expect(await equipmentPose(page)).toEqual(pausedGear);
  await page.screenshot({ path: info.outputPath('equipped-gameplay-paused.png') });
  await stick(page, 0);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect.poll(async () => (await state(page)).state).toBe('idle');
  await expect.poll(async () => (await state(page)).diagnostics?.representation).toBe('meshy');
  await expect.poll(async () => (await state(page)).diagnostics?.weights.idle).toBe(1);
  await expect.poll(() => page.evaluate(() => (window as TestWindow).__veylun.camera.camera.getScene().getTransformNodeByName('ruen-provisional')!.isEnabled())).toBe(false);
  await expect.poll(async () => (await state(page)).diagnostics?.clips.filter(clip => clip.isPlaying).map(clip => clip.name)).toEqual([equippedNames.idle]);
  const returned = await equipmentPose(page);
  expectSameFeet(returned, standing);
  expectGearAttached(returned);
  await expect.poll(async () => (await equipmentPose(page)).torso).not.toEqual(returned.torso);
  expectSameFeet(await equipmentPose(page), standing);
  await page.screenshot({ path: info.outputPath('equipped-gameplay-idle.png') });

  for (const [key, pattern] of [['Space', /^(jump|fall)$/], ['ShiftLeft', /^roll$/], ['KeyJ', /^attack[123]$/], ['KeyK', /^shield$/]] as const) {
    await page.keyboard.down(key);
    await expect.poll(async () => (await state(page)).state, { intervals: [25, 50, 100] }).toMatch(pattern);
    const action = await state(page);
    expect(action.diagnostics?.representation).toBe('fallback');
    expect(action.diagnostics!.clips.every(clip => !clip.isPlaying)).toBe(true);
    expectGearAttached(await equipmentPose(page), false);
    await page.keyboard.up(key);
    await expect.poll(async () => (await state(page)).state, { timeout: 10000 }).toBe('idle');
    await expect.poll(async () => (await state(page)).grounded).toBe(true);
    await expect.poll(async () => (await state(page)).diagnostics?.representation).toBe('meshy');
    await expect.poll(async () => (await state(page)).diagnostics?.weights.idle).toBe(1);
    expectGearAttached(await equipmentPose(page));
  }
  expect(await originalClipFingerprint(page)).toEqual(originalClips);
  const final = await equipmentPose(page);
  expect(final.health).toBe(standing.health);
  expect(final.enemyHealth).toEqual(standing.enemyHealth);
  expect(requests).toHaveLength(3);
  await info.attach('equipped-runtime-inventory.json', { body: JSON.stringify(inventory, null, 2), contentType: 'application/json' });
  await info.attach('equipped-blend-samples.json', { body: JSON.stringify({ idleToWalk, walkToRun: samples }, null, 2), contentType: 'application/json' });
  await info.attach('equipped-gameplay-console.json', { body: JSON.stringify(errors, null, 2), contentType: 'application/json' });
  expect(errors).toEqual([]);
});

test('actual collision displacement freezes Meshy even while the controller requests movement', async ({ page }, info) => {
  const errors = collectErrors(page);
  // Existing opt-in URL remains a compatible alias after making Meshy the default.
  await startTrial(page, '/?ruen=meshy&test=1');
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
  const frame = blocked.diagnostics!.clips.find(clip => clip.name === equippedNames.run)!.frame;
  await page.waitForTimeout(400);
  const stillBlocked = await state(page);
  expect(stillBlocked.z).toBe(-10);
  expect(stillBlocked.diagnostics!.clips.find(clip => clip.name === equippedNames.run)!.frame).toBeCloseTo(frame, 5);
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
  await page.goto('/?test=1');
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

test('explicit provisional opt-out keeps the old Ruen without requesting the Meshy master', async ({ page }, info) => {
  const errors = collectErrors(page);
  const modelRequests: string[] = [];
  page.on('request', request => { if (/\.glb(?:\?|$)/.test(request.url())) modelRequests.push(request.url()); });
  await page.goto('/?ruen=provisional&test=1');
  await expect(page.locator('body')).toHaveAttribute('data-engine', 'ready', { timeout: 60000 });
  expect(await page.evaluate(() => (window as TestWindow).__veylun.locomotion === undefined)).toBe(true);
  await page.getByRole('button', { name: 'Nueva partida', exact: true }).click();
  const initial = await state(page);
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await state(page)).z).toBeGreaterThan(initial.z + .2);
  await page.keyboard.up('KeyW');
  expect(await page.evaluate(() => (window as TestWindow).__veylun.camera.camera.getScene().getTransformNodeByName('ruen-provisional')!.isEnabled())).toBe(true);
  expect(modelRequests).toEqual([]);
  await info.attach('provisional-opt-out-console.json', { body: JSON.stringify(errors, null, 2), contentType: 'application/json' });
  expect(errors).toEqual([]);
});

test('production loads equipped Ruen automatically and honors the provisional opt-out without debug hooks', async ({ page }, info) => {
  const errors = collectErrors(page);
  const modelRequests: string[] = [];
  page.on('request', request => { if (/\.glb(?:\?|$)/.test(request.url())) modelRequests.push(request.url()); });
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.locator('body')).toHaveAttribute('data-engine', 'ready', { timeout: 60000 });
  await expect(page.locator('#ruen-model-status')).toHaveAttribute('data-status', 'ready', { timeout: 120000 });
  await expect(page.locator('#ruen-model-status')).toHaveAttribute('data-representation', 'meshy');
  await expect(page.locator('#ruen-model-status')).toHaveAttribute('data-equipment-status', 'ready');
  expect(modelRequests).toHaveLength(3);
  expect(await page.evaluate(() => '__veylun' in window)).toBe(false);
  await page.getByRole('button', { name: 'Nueva partida', exact: true }).click();
  await expect(page.locator('#ruen-model-status')).toHaveAttribute('data-representation', 'meshy');
  await expect(page.locator('#ruen-model-status')).toHaveAttribute('data-equipment-status', 'ready');
  await page.screenshot({ path: info.outputPath('meshy-production-default-idle.png') });

  await page.goto('http://127.0.0.1:4173/?ruen=provisional');
  await expect(page.locator('body')).toHaveAttribute('data-engine', 'ready', { timeout: 60000 });
  expect(await page.evaluate(() => '__veylun' in window)).toBe(false);
  await page.getByRole('button', { name: 'Continuar aventura', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Pausa' })).toBeVisible();
  expect(modelRequests).toHaveLength(3);
  await info.attach('production-default-requests.json', { body: JSON.stringify(modelRequests, null, 2), contentType: 'application/json' });
  await info.attach('production-default-console.json', { body: JSON.stringify(errors, null, 2), contentType: 'application/json' });
  expect(errors).toEqual([]);
});


test('a missing runtime shield keeps a neutral real hero playable without partial floating equipment', async ({ page }, info) => {
  const errors = collectErrors(page);
  const unhandled: string[] = [];
  page.on('pageerror', error => unhandled.push(error.message));
  const requests: string[] = [];
  page.on('request', request => { if (/\.glb(?:\?|$)/.test(request.url())) requests.push(request.url()); });
  await page.route('**/assets/models/ruen/equipment/runtime/aegis-of-the-azure.glb', route =>
    route.fulfill({ status: 503, body: 'Intentional runtime shield failure' }));
  await installPad(page);
  await startTrial(page);
  await expect(page.locator('#ruen-model-status')).toHaveAttribute('data-equipment-status', 'partial');
  await expect.poll(async () => (await state(page)).diagnostics?.representation).toBe('meshy');
  await expect.poll(async () => (await state(page)).diagnostics?.weights.idle).toBe(1);
  const initial = await state(page);
  expect(initial.diagnostics?.status).toBe('ready');
  expect(initial.diagnostics?.equipped).toBe(false);
  expect(initial.diagnostics?.equipment?.enabled).toBe(false);
  expect(initial.diagnostics?.clips.filter(clip => clip.isPlaying).map(clip => clip.name)).toEqual(['Ruen_Idle_Unarmed']);
  const fallback = await page.evaluate(() => {
    const view = (window as TestWindow).__veylun.locomotion!;
    const model = view.model!;
    return { report: model.report, groups: model.container.animationGroups.map(group => group.name),
      gear: view.equipment!.models.map(item => ({ kind: item.kind, enabled: item.mount.isEnabled() })),
      armDots: model.container.transformNodes.filter(node => /mixamorig:(Left|Right)(Arm|ForeArm|Hand.*)$/.test(node.name)).map(node => {
        const current = node.rotationQuaternion!, rest = current.clone();
        model.container.skeletons[0]!.bones.find(bone => bone.getTransformNode() === node)!.getRestMatrix().decompose(undefined, rest);
        const dot = current.asArray().reduce((sum, value, index) => sum + value * rest.asArray()[index]!, 0);
        return Math.abs(dot / Math.sqrt(current.lengthSquared() * rest.lengthSquared()));
      }) };
  });
  expect(fallback.report.animationGroups).toHaveLength(20);
  expect(fallback.groups).toHaveLength(23);
  expect(fallback.groups.some(name => name.endsWith('_Equipped'))).toBe(false);
  expect(fallback.gear).toEqual([{ kind: 'sword', enabled: false }]);
  fallback.armDots.forEach(dot => expect(dot).toBeCloseTo(1, 6));
  await stick(page, .45);
  await expect.poll(async () => (await state(page)).diagnostics?.weights.walk).toBe(1);
  await expect.poll(async () => (await state(page)).diagnostics?.clips.filter(clip => clip.isPlaying).map(clip => clip.name)).toEqual(['Ruen_Walk_Unarmed']);
  await stick(page, 1);
  await expect.poll(async () => (await state(page)).diagnostics?.weights.run).toBe(1);
  await expect.poll(async () => (await state(page)).diagnostics?.clips.filter(clip => clip.isPlaying).map(clip => clip.name)).toEqual(['Ruen_Run_Unarmed']);
  expect((await state(page)).z).toBeGreaterThan(initial.z + .2);
  await stick(page, 0);
  await expect.poll(async () => (await state(page)).diagnostics?.weights.idle).toBe(1);
  expect(await page.evaluate(() => (window as TestWindow).__veylun.locomotion!.equipment!.models.every(item => !item.mount.isEnabled()))).toBe(true);
  expect(requests).toHaveLength(3);
  await page.screenshot({ path: info.outputPath('runtime-equipment-failure-neutral-hero.png') });
  await info.attach('runtime-equipment-failure.json', { body: JSON.stringify({ initial, fallback, errors, unhandled }, null, 2), contentType: 'application/json' });
  expect(unhandled).toEqual([]);
  expect(errors.every(message => /503|Service Unavailable|Intentional runtime|Unable to load|Failed to load resource/.test(message))).toBe(true);
});
