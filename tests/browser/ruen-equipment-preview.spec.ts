import { expect, test, type Page } from '@playwright/test';
import type { AssetInspector } from '../../src/inspection/AssetInspector';
import type { RuenEquipmentPreview } from '../../src/assets/RuenEquipmentPreview';
import { SAVE_KEY } from '../../src/progression/save';
import { inspectionGlb } from '../fixtures/inspection-glb';

// Art acceptance uses all three real GLBs. The fixture is used only for disposal.
test.use({ baseURL: 'http://127.0.0.1:5174', viewport: { width: 1100, height: 800 } });
test.setTimeout(360000);
const armedName = 'Ruen_Idle_Armed_v1';
const neutralName = 'Ruen_Idle_v1';
const previewUrl = '/?inspect=ruen&motion=idle-v1&equipment=azure&test=1';
const swordPattern = '**/assets/models/ruen/equipment/Meshy_AI_Azure_Oathblade_1022220336_texture.glb';
const untouchedSave = 'equipment-preview-must-not-change-the-adventure';
type PreviewWindow = Window & { __assetInspector: AssetInspector & { equipment?: RuenEquipmentPreview } };

function collectErrors(page: Page) {
  const errors = { unhandled: [] as string[], console: [] as string[] };
  page.on('pageerror', error => errors.unhandled.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()); });
  return errors;
}

async function preserveSave(page: Page) {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: SAVE_KEY, value: untouchedSave });
}

async function waitForEquipment(page: Page) {
  await expect(page.locator('#asset-status')).toHaveAttribute('data-state', 'loaded', { timeout: 150000 });
  await expect(page.locator('#asset-equipment-status')).toHaveAttribute('data-state', 'ready', { timeout: 150000 });
}

async function playingClips(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as PreviewWindow).__assetInspector.model!.container.animationGroups
    .filter(group => group.isPlaying).map(group => group.name));
}

/** Explicit paused sampling avoids timing assertions on a software renderer. */
async function sample(page: Page, frame?: number) {
  return page.evaluate(frame => {
    const inspector = (window as unknown as PreviewWindow).__assetInspector;
    const model = inspector.model!;
    if (frame !== undefined) {
      if (model.player.isPlaying) throw new Error('Pause the clip before seeking a sample.');
      model.player.current!.goToFrame(frame);
    }
    inspector.scene.render();
    const transform = (point: readonly number[], matrix: ArrayLike<number>) => [
      point[0]! * matrix[0]! + point[1]! * matrix[4]! + point[2]! * matrix[8]! + matrix[12]!,
      point[0]! * matrix[1]! + point[1]! * matrix[5]! + point[2]! * matrix[9]! + matrix[13]!,
      point[0]! * matrix[2]! + point[1]! * matrix[6]! + point[2]! * matrix[10]! + matrix[14]!,
    ];
    const gear = inspector.equipment!;
    const report = gear.report;
    return {
      frame: model.player.current!.getCurrentFrame(), speed: model.player.speed, playing: model.player.isPlaying,
      pose: model.container.transformNodes.filter(node => /mixamorig:(Left|Right)(Arm|ForeArm|Hand.*)$/.test(node.name))
        .map(node => ({ name: node.name, rotation: node.rotationQuaternion!.asArray() })),
      feet: model.container.transformNodes.filter(node => /mixamorig:(Hips|LeftFoot|RightFoot)$/.test(node.name))
        .map(node => ({ name: node.name, world: Array.from(node.computeWorldMatrix(true).asArray()) })),
      gear: gear.models.map(item => {
        const profile = report.items.find(profile => profile.kind === item.kind)!;
        const hand = model.container.transformNodes.find(node => node.name === profile.hand)!;
        const gripWorld = transform(profile.grip, item.model.root.computeWorldMatrix(true).asArray());
        return {
          kind: item.kind, enabled: item.mount.isEnabled(), parent: item.mount.parent?.name,
          boneLinked: model.container.skeletons[0]!.bones.find(bone => bone.name === profile.hand)!.getTransformNode() === item.mount.parent,
          gripWorld, gripInHand: transform(gripWorld, hand.computeWorldMatrix(true).clone().invert().asArray()),
          expectedGripInHand: [...profile.handOffset], mountPosition: item.mount.position.asArray(),
          mountRotation: item.mount.rotation.asArray(), mountScale: item.mount.scaling.asArray(),
        };
      }),
    };
  }, frame);
}

function expectClose(actual: readonly number[], expected: readonly number[], digits = 6) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index]!, digits));
}

/** Read immutable imported rest matrices/clip keys, never a pose already played by the preview. */
async function importedRotations(page: Page, useClip: boolean) {
  return page.evaluate(useClip => {
    const model = (window as unknown as PreviewWindow).__assetInspector.model!;
    return model.container.transformNodes.filter(node => /mixamorig:(Left|Right)(Arm|ForeArm|Hand.*)$/.test(node.name))
      .map(node => {
        const rotation = node.rotationQuaternion!.clone();
        const bone = model.container.skeletons[0]!.bones.find(bone => bone.getTransformNode() === node)!;
        bone.getRestMatrix().decompose(undefined, rotation);
        if (useClip) {
          const track = model.player.current!.targetedAnimations.find(track => track.target === node && track.animation.targetProperty === 'rotationQuaternion');
          if (track) {
            const first = track.animation.getKeys()[0]!;
            if (first.frame !== 0) throw new Error('Expected the original locomotion rotation track to begin at frame zero.');
            rotation.copyFrom(first.value);
          }
        }
        return { name: node.name, rotation: rotation.asArray() };
      });
  }, useClip);
}

function expectPose(actual: Awaited<ReturnType<typeof importedRotations>>, expected: Awaited<ReturnType<typeof importedRotations>>) {
  expect(actual.map(node => node.name)).toEqual(expected.map(node => node.name));
  actual.forEach((node, index) => {
    const wanted = expected[index]!.rotation;
    const dot = node.rotation.reduce((sum, value, axis) => sum + value * wanted[axis]!, 0);
    const lengths = Math.sqrt(node.rotation.reduce((sum, value) => sum + value * value, 0) * wanted.reduce((sum, value) => sum + value * value, 0));
    // q and -q represent the same rotation.
    expect(Math.abs(dot / lengths), node.name).toBeCloseTo(1, 6);
  });
}

test('real equipment follows the hands through Idle, toggles cleanly, and releases on model replacement', async ({ page }, info) => {
  test.setTimeout(600000);
  const errors = collectErrors(page);
  await preserveSave(page);
  const requests: string[] = [];
  page.on('request', request => { if (/\.glb(?:\?|$)/.test(request.url())) requests.push(request.url()); });
  await page.goto(previewUrl);
  await waitForEquipment(page);
  expect(requests).toHaveLength(3);
  await expect(page.locator('#asset-clip')).toHaveValue(armedName);
  await expect(page.locator('#asset-equipment-toggle')).toBeChecked();
  await expect(page.locator('#asset-playback')).toHaveText(`${armedName} · Pausado`);
  expect(await playingClips(page)).toEqual([]);

  const inventory = await page.evaluate(() => {
    const inspector = (window as unknown as PreviewWindow).__assetInspector;
    return { hero: inspector.model!.report, groups: inspector.model!.container.animationGroups.map(group => group.name),
      equipment: inspector.equipment!.report };
  });
  expect(inventory.hero.animationGroups).toHaveLength(20);
  expect(inventory.groups).toHaveLength(22);
  expect(new Set(inventory.groups).size).toBe(22);
  expect(inventory.equipment.status).toBe('ready');
  expect(inventory.equipment.items).toHaveLength(2);
  for (const item of inventory.equipment.items) {
    expect(item.inventory!.animationGroups).toHaveLength(0);
    expect(item.inventory!.skeletons).toHaveLength(0);
    expect(item.inventory!.materials).toHaveLength(1);
    expect(item.inventory!.materials[0]!.textures).toHaveLength(3);
    expect(item.inventory!.materials[0]!.textures.every(texture => texture.width === 2048 && texture.height === 2048)).toBe(true);
    expect(item.inventory!.meshes.reduce((sum, mesh) => sum + mesh.triangles, 0)).toBe(item.kind === 'sword' ? 218230 : 688602);
  }
  const exported = JSON.parse((await page.locator('#asset-report').textContent())!);
  expect(exported.animationGroups).toHaveLength(20);
  expect(exported.equipmentPreview).toBeDefined();

  const samples: Awaited<ReturnType<typeof sample>>[] = [];
  for (const frame of [0, 60, 120]) {
    const current = await sample(page, frame); samples.push(current);
    for (const gear of current.gear) {
      expect(gear.enabled).toBe(true);
      expect(gear.parent).toBe(gear.kind === 'sword' ? 'mixamorig:RightHand' : 'mixamorig:LeftHand');
      expect(gear.boneLinked).toBe(true);
      expectClose(gear.gripInHand, gear.expectedGripInHand);
    }
  }
  expect(samples[1]!.gear.map(item => item.gripWorld)).not.toEqual(samples[0]!.gear.map(item => item.gripWorld));
  samples[2]!.gear.forEach((gear, index) => expectClose(gear.gripWorld, samples[0]!.gear[index]!.gripWorld));
  samples.slice(1).forEach(current => current.feet.forEach((foot, index) => expectClose(foot.world, samples[0]!.feet[index]!.world)));

  await sample(page, 60);
  await page.locator('#asset-speed').evaluate((input: HTMLInputElement) => {
    input.value = '1.5'; input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#asset-equipment-toggle').uncheck();
  await expect(page.locator('#asset-clip')).toHaveValue(neutralName);
  const neutral = await sample(page);
  expect(neutral.frame).toBeCloseTo(60, 6);
  expect(neutral.playing).toBe(false);
  expect(neutral.speed).toBe(1.5);
  expect(neutral.gear.every(item => !item.enabled)).toBe(true);
  expect(neutral.pose).not.toEqual(samples[1]!.pose);
  expectPose(neutral.pose, await importedRotations(page, false));
  await page.locator('#asset-equipment-toggle').check();
  await expect(page.locator('#asset-clip')).toHaveValue(armedName);
  const restored = await sample(page);
  expect(restored.frame).toBeCloseTo(60, 6);
  expect(restored.pose).toEqual(samples[1]!.pose);
  expect(restored.playing).toBe(false);
  expect(restored.speed).toBe(1.5);
  expect(restored.gear.every(item => item.enabled)).toBe(true);

  for (const view of ['front', 'side', 'back']) {
    await page.locator(`#asset-view-${view}`).click();
    await page.locator('#asset-inspector').evaluate(panel => { panel.scrollTop = 0; });
    await page.evaluate(() => (window as unknown as PreviewWindow).__assetInspector.scene.render());
    await page.screenshot({ path: info.outputPath(`ruen-equipped-idle-${view}.png`) });
  }
  await page.locator('#asset-play').click();
  await expect.poll(() => playingClips(page)).toEqual([armedName]);
  await page.locator('#asset-equipment-toggle').uncheck();
  await expect.poll(() => playingClips(page)).toEqual([neutralName]);
  await page.locator('#asset-equipment-toggle').check();
  await expect.poll(() => playingClips(page)).toEqual([armedName]);

  for (const original of ['Walking', 'Running']) {
    await page.locator('#asset-clip').selectOption(original);
    await expect.poll(() => playingClips(page)).toEqual([original]);
    await expect(page.locator('#asset-equipment-toggle')).not.toBeChecked();
    await page.locator('#asset-play').click();
    const baseline = await sample(page, 0);
    expectPose(baseline.pose, await importedRotations(page, true));
    expect(baseline.gear.every(item => !item.enabled)).toBe(true);
    await page.locator('#asset-equipment-toggle').check();
    await expect(page.locator('#asset-clip')).toHaveValue(armedName);
    await page.locator('#asset-clip').selectOption(original);
    await page.locator('#asset-play').click();
    expect((await sample(page, 0)).pose).toEqual(baseline.pose);
  }
  await page.locator('#asset-clip').selectOption(neutralName);
  await page.locator('#asset-play').click();
  expect((await sample(page, 60)).pose).toEqual(neutral.pose);
  expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBe(untouchedSave);
  expect(await page.evaluate(() => '__veylun' in window)).toBe(false);

  // Keep references to the real assets so replacement verifies ownership, not just UI state.
  await page.evaluate(() => {
    const inspector = (window as unknown as PreviewWindow).__assetInspector;
    const items = [...inspector.equipment!.models];
    const materials = items.flatMap(item => [...item.model.container.materials]);
    const textures = items.flatMap(item => [...item.model.container.textures]);
    Object.assign(window, { __oldEquipmentDisposed: () => items.every(item =>
      item.mount.isDisposed() && item.model.root.isDisposed()) && materials.length > 0 && textures.length > 0 &&
      materials.every(material => !inspector.scene.materials.includes(material)) &&
      textures.every(texture => !inspector.scene.textures.includes(texture)) });
  });
  await page.locator('#asset-file').setInputFiles({ name: 'synthetic-inspection-fixture.glb', mimeType: 'model/gltf-binary', buffer: inspectionGlb() });
  await expect(page.locator('#asset-report')).toContainText('SyntheticSkeleton', { timeout: 60000 });
  expect(await page.evaluate(() => (window as unknown as Window & { __oldEquipmentDisposed: () => boolean }).__oldEquipmentDisposed())).toBe(true);
  expect(await page.evaluate(() => (window as unknown as PreviewWindow).__assetInspector.scene.transformNodes
    .filter(node => /^ruen-equipment-.*-mount$/.test(node.name)).length)).toBe(0);
  await info.attach('equipment-inventory.json', { body: JSON.stringify({ inventory, exported }, null, 2), contentType: 'application/json' });
  await info.attach('equipment-idle-samples.json', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
  await info.attach('equipment-console.json', { body: JSON.stringify(errors, null, 2), contentType: 'application/json' });
  expect(errors).toEqual({ unhandled: [], console: [] });
});

test('a failed sword leaves neutral Idle usable and retry replaces partial equipment without reloading Ruen', async ({ page }, info) => {
  const errors = collectErrors(page);
  await preserveSave(page);
  let failSword = true;
  const requests: string[] = [];
  page.on('request', request => { if (/\.glb(?:\?|$)/.test(request.url())) requests.push(request.url()); });
  await page.route(swordPattern, route => failSword ? route.fulfill({ status: 503, body: 'Intentional equipment transport failure' }) : route.continue());
  await page.goto(previewUrl);
  await expect(page.locator('#asset-status')).toHaveAttribute('data-state', 'loaded', { timeout: 150000 });
  await expect(page.locator('#asset-equipment-status')).toHaveAttribute('data-state', 'partial', { timeout: 150000 });
  await expect(page.locator('#asset-clip')).toHaveValue(neutralName);
  await expect(page.locator('#asset-equipment-toggle')).not.toBeChecked();
  await expect(page.locator('#asset-equipment-retry')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as PreviewWindow).__assetInspector.equipment!.models.every(item => !item.mount.isEnabled()))).toBe(true);
  await page.locator('#asset-play').click();
  await expect.poll(() => playingClips(page)).toEqual([neutralName]);
  const failed = await page.evaluate(() => {
    const inspector = (window as unknown as PreviewWindow).__assetInspector;
    const hero = inspector.model;
    const partial = [...inspector.equipment!.models];
    Object.assign(window, { __equipmentRetryState: () => ({ sameHero: inspector.model === hero,
      previousDisposed: partial.every(item => item.mount.isDisposed() && item.model.root.isDisposed()) }) });
    return inspector.equipment!.diagnostics;
  });
  failSword = false;
  await page.locator('#asset-equipment-retry').click();
  await waitForEquipment(page);
  await expect(page.locator('#asset-clip')).toHaveValue(armedName);
  await expect(page.locator('#asset-playback')).toHaveText(`${armedName} · Pausado`);
  expect(await page.evaluate(() => (window as unknown as Window & { __equipmentRetryState: () => unknown }).__equipmentRetryState())).toEqual({ sameHero: true, previousDisposed: true });
  expect(requests.filter(url => url.includes('Crimson_Gemwarden'))).toHaveLength(1);
  expect(requests.filter(url => url.includes('/equipment/'))).toHaveLength(4);
  expect(await page.evaluate(() => (window as unknown as PreviewWindow).__assetInspector.model!.container.animationGroups.filter(group => group.name === 'Ruen_Idle_Armed_v1').length)).toBe(1);
  expect(await page.evaluate(() => (window as unknown as PreviewWindow).__assetInspector.scene.transformNodes.filter(node => /^ruen-equipment-.*-mount$/.test(node.name)).length)).toBe(2);
  expect((await sample(page, 0)).gear.every(item => item.enabled && item.boneLinked)).toBe(true);
  expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBe(untouchedSave);
  await info.attach('equipment-retry-evidence.json', { body: JSON.stringify({ failed, errors, requests }, null, 2), contentType: 'application/json' });
  expect(errors.unhandled).toEqual([]);
  expect(errors.console.every(message => /503|Service Unavailable|Intentional equipment|Unable to load|Failed to load resource/.test(message))).toBe(true);
});

test('production opens equipped Idle and comparison controls without development hooks', async ({ page }, info) => {
  const errors = collectErrors(page);
  await preserveSave(page);
  const requests: string[] = [];
  page.on('request', request => { if (/\.glb(?:\?|$)/.test(request.url())) requests.push(request.url()); });
  await page.goto('http://127.0.0.1:4173/?inspect=ruen&motion=idle-v1&equipment=azure');
  await waitForEquipment(page);
  expect(requests).toHaveLength(3);
  expect(await page.evaluate(() => ({ inspector: '__assetInspector' in window, game: '__veylun' in window }))).toEqual({ inspector: false, game: false });
  await expect(page.locator('#asset-clip')).toHaveValue(armedName);
  await expect(page.locator('#asset-playback')).toHaveText(`${armedName} · Pausado`);
  await page.locator('#asset-play').click();
  await expect(page.locator('#asset-playback')).toHaveText(`${armedName} · Reproduciendo`);
  await page.locator('#asset-equipment-toggle').uncheck();
  await expect(page.locator('#asset-playback')).toHaveText(`${neutralName} · Reproduciendo`);
  await page.locator('#asset-equipment-toggle').check();
  await expect(page.locator('#asset-playback')).toHaveText(`${armedName} · Reproduciendo`);
  await page.locator('#asset-clip').selectOption('Running');
  await expect(page.locator('#asset-equipment-toggle')).not.toBeChecked();
  await page.locator('#asset-equipment-toggle').check();
  await page.locator('#asset-play').click();
  await expect(page.locator('#asset-playback')).toHaveText(`${armedName} · Pausado`);
  expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBe(untouchedSave);
  await page.locator('#asset-inspector').evaluate(panel => { panel.scrollTop = 0; });
  await page.screenshot({ path: info.outputPath('production-equipped-idle.png') });
  await info.attach('production-equipment-console.json', { body: JSON.stringify(errors, null, 2), contentType: 'application/json' });
  expect(errors).toEqual({ unhandled: [], console: [] });
});
