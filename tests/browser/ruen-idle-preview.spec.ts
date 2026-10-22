import { expect, test, type Page } from '@playwright/test';
import type { AssetInspector } from '../../src/inspection/AssetInspector';
import { SAVE_KEY } from '../../src/progression/save';
import { inspectionGlb } from '../fixtures/inspection-glb';

// This authored clip is a preview layered onto the real master, not a gameplay Idle.
test.use({ baseURL: 'http://127.0.0.1:5174', viewport: { width: 1280, height: 900 } });
test.setTimeout(180000);
const idleName = 'Ruen_Idle_v1';
const previewUrl = '/?inspect=ruen&motion=idle-v1&test=1';
const assetPattern = '**/assets/models/ruen/Meshy_AI_Crimson_Gemwarden_All_Animations.glb';
const untouchedSave = 'idle-preview-must-not-change-the-adventure';
type PreviewWindow = Window & { __assetInspector: AssetInspector };

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
}

async function preserveSave(page: Page): Promise<void> {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: SAVE_KEY, value: untouchedSave });
}

async function playingClips(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as PreviewWindow).__assetInspector.model!.container.animationGroups
    .filter(group => group.isPlaying).map(group => group.name));
}

/** Seek only while paused, so exact-frame geometry does not depend on renderer speed. */
async function pose(page: Page, frame?: number) {
  return page.evaluate(frame => {
    const inspector = (window as PreviewWindow).__assetInspector;
    const model = inspector.model!;
    if (frame !== undefined) {
      if (model.player.isPlaying) throw new Error('Pause the preview before sampling a specific frame.');
      model.player.current!.goToFrame(frame);
    }
    inspector.scene.render();
    const stableNames = ['mixamorig:Hips', 'mixamorig:Spine',
      'mixamorig:LeftUpLeg', 'mixamorig:LeftLeg', 'mixamorig:LeftFoot', 'mixamorig:LeftToeBase', 'mixamorig:LeftToe_End',
      'mixamorig:RightUpLeg', 'mixamorig:RightLeg', 'mixamorig:RightFoot', 'mixamorig:RightToeBase', 'mixamorig:RightToe_End'];
    const find = (name: string) => {
      const node = model.container.transformNodes.find(node => node.name === name);
      if (!node) throw new Error(`Missing master joint: ${name}`);
      node.computeWorldMatrix(true);
      return node;
    };
    model.root.computeWorldMatrix(true);
    return {
      root: { position: model.root.position.asArray(), rotation: model.root.rotation.asArray(),
        scale: model.root.scaling.asArray(), world: Array.from(model.root.getWorldMatrix().asArray()) },
      stationary: stableNames.map(name => {
        const node = find(name);
        return { name, position: node.position.asArray(), rotation: node.rotationQuaternion!.asArray(),
          scale: node.scaling.asArray(), world: Array.from(node.getWorldMatrix().asArray()),
          worldPosition: node.getAbsolutePosition().asArray() };
      }),
      torso: ['mixamorig:Spine1', 'mixamorig:Spine2'].map(name => ({ name, rotation: find(name).rotationQuaternion!.asArray() })),
      frame: model.player.current!.getCurrentFrame(),
    };
  }, frame);
}

function expectStationary(actual: Awaited<ReturnType<typeof pose>>, expected: Awaited<ReturnType<typeof pose>>): void {
  expect(actual.root).toEqual(expected.root);
  expect(actual.stationary.map(node => node.name)).toEqual(expected.stationary.map(node => node.name));
  for (let i = 0; i < actual.stationary.length; i++) {
    const after = actual.stationary[i]!, before = expected.stationary[i]!;
    for (const component of ['position', 'rotation', 'scale', 'world', 'worldPosition'] as const) {
      after[component].forEach((value, axis) => expect(value, `${after.name}.${component}[${axis}]`).toBeCloseTo(before[component][axis]!, 7));
    }
  }
}

test('authored Idle previews on the real master with a closed breathing loop and stationary feet', async ({ page }, info) => {
  const errors = collectErrors(page);
  await preserveSave(page);
  const requests: string[] = [];
  page.on('request', request => { if (/\.glb(?:\?|$)/.test(request.url())) requests.push(request.url()); });
  await page.goto(previewUrl);
  await expect(page.locator('#asset-status')).toHaveAttribute('data-state', 'loaded', { timeout: 120000 });
  expect(requests).toHaveLength(1);
  await expect(page.locator('#asset-clip')).toHaveValue(idleName);
  await expect(page.locator('#asset-clip option:checked')).toHaveText('Idle neutro · prototipo v1 · 4.000 s');
  await expect(page.locator('#asset-playback')).toHaveText(`${idleName} · Pausado`);
  await expect(page.locator('#asset-clip-warning')).toContainText('creado para Veylun');
  await expect(page.locator('#asset-clip-warning')).toContainText('No forma parte del archivo original');
  expect(await playingClips(page)).toEqual([]);
  expect(await page.evaluate(() => '__veylun' in window)).toBe(false);

  const inventory = await page.evaluate(() => {
    const { model } = (window as PreviewWindow).__assetInspector;
    const authored = model!.container.animationGroups.find(group => group.name === 'Ruen_Idle_v1')!;
    return { report: model!.report, groups: model!.container.animationGroups.map(group => group.name),
      authored: { from: authored.from, to: authored.to, tracks: authored.targetedAnimations.map(track => ({
        target: track.target.name, property: track.animation.targetProperty, fps: track.animation.framePerSecond,
        first: track.animation.getKeys()[0]!.value.asArray(), last: track.animation.getKeys().at(-1)!.value.asArray(),
      })) } };
  });
  expect(inventory.report.animationGroups).toHaveLength(20);
  expect(inventory.report.animationGroups.some(group => /idle/i.test(group.name))).toBe(false);
  expect(inventory.report.skeletons[0]?.name).toBe('SmartRigArmature');
  expect(inventory.report.skeletons[0]?.bones).toHaveLength(80);
  expect(inventory.report.materials.map(material => material.name)).toEqual(['BakedMaterial']);
  expect(inventory.groups).toHaveLength(21);
  expect(inventory.groups.filter(name => name === idleName)).toHaveLength(1);
  expect(inventory.authored.from).toBe(0);
  expect(inventory.authored.to).toBe(120);
  expect(inventory.authored.tracks.map(track => track.target).sort()).toEqual(['mixamorig:Spine1', 'mixamorig:Spine2']);
  for (const track of inventory.authored.tracks) {
    expect(track.fps).toBe(30);
    expect(track.property).toBe('rotationQuaternion');
    expect(track.first).toEqual(track.last);
  }
  const exportedReport = JSON.parse((await page.locator('#asset-report').textContent())!);
  expect(exportedReport.animationGroups).toHaveLength(20);
  expect(exportedReport.authoredPreview).toEqual({ name: idleName, author: 'Veylun', stage: 'prototype-v1',
    durationSeconds: 4, notInMaster: true, gameplayIntegrated: false });

  const initial = await pose(page, 0);
  await page.locator('#asset-play').click();
  await expect.poll(() => playingClips(page)).toEqual([idleName]);
  await expect.poll(async () => (await pose(page)).torso).not.toEqual(initial.torso);
  await page.locator('#asset-speed').evaluate((input: HTMLInputElement) => {
    input.value = '1.5'; input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect.poll(() => page.evaluate(() => (window as PreviewWindow).__assetInspector.model!.player.current!.speedRatio)).toBe(1.5);
  await page.locator('#asset-play').click();
  await expect.poll(() => playingClips(page)).toEqual([]);
  const paused = await pose(page);
  expect(await pose(page)).toEqual(paused);

  const samples = [];
  for (const frame of [0, 30, 60, 90, 120]) {
    const sample = await pose(page, frame);
    expectStationary(sample, initial);
    samples.push(sample);
  }
  expect(samples[2]!.torso).not.toEqual(samples[0]!.torso);
  expect(samples[4]!.torso).toEqual(samples[0]!.torso);
  for (const view of ['front', 'side', 'back']) {
    await pose(page, 60);
    await page.locator(`#asset-view-${view}`).click();
    await page.locator('#asset-inspector').evaluate(panel => { panel.scrollTop = 0; });
    await page.evaluate(() => new Promise<void>(resolve => {
      (window as PreviewWindow).__assetInspector.scene.onAfterRenderObservable.addOnce(() => resolve());
    }));
    await page.screenshot({ path: info.outputPath(`ruen-idle-v1-inhale-${view}.png`) });
  }

  for (const original of ['Walking', 'Running']) {
    await page.locator('#asset-clip').selectOption(original);
    await expect.poll(() => playingClips(page)).toEqual([original]);
    await page.locator('#asset-play').click();
    const midpoint = await page.evaluate(() => {
      const group = (window as PreviewWindow).__assetInspector.model!.player.current!;
      return group.from + (group.to - group.from) * .35;
    });
    const movingPose = await pose(page, midpoint);
    expect(movingPose.stationary).not.toEqual(initial.stationary);
    await page.locator('#asset-clip').selectOption(idleName);
    await expect.poll(() => playingClips(page)).toEqual([idleName]);
    await page.locator('#asset-play').click();
    // The torso-only clip must not inherit the last locomotion pose in hips, legs or feet.
    const returned = await pose(page, 0);
    expectStationary(returned, initial);
    expect(returned.torso).toEqual(initial.torso);
  }
  expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBe(untouchedSave);
  expect(await page.evaluate(() => '__veylun' in window)).toBe(false);
  await info.attach('idle-preview-inventory.json', { body: JSON.stringify({ inventory, exportedReport }, null, 2), contentType: 'application/json' });
  await info.attach('idle-preview-frame-samples.json', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
  await info.attach('idle-preview-console.json', { body: JSON.stringify(errors, null, 2), contentType: 'application/json' });
  expect(errors).toEqual([]);
});

test('an incompatible synthetic rig keeps its original clips available without adding a false Idle', async ({ page }, info) => {
  const errors = collectErrors(page);
  await preserveSave(page);
  await page.route(assetPattern, route => route.fulfill({ contentType: 'model/gltf-binary', body: inspectionGlb() }));
  await page.goto(previewUrl);
  await expect(page.locator('#asset-status')).toHaveAttribute('data-state', 'loaded', { timeout: 60000 });
  await expect(page.locator('#asset-status')).toContainText('Prototipo Idle no disponible para este modelo.');
  await expect(page.locator('#asset-clip')).toHaveValue('Walking');
  await expect(page.locator(`#asset-clip option[value="${idleName}"]`)).toHaveCount(0);
  expect(await page.evaluate(() => (window as PreviewWindow).__assetInspector.model!.container.animationGroups.map(group => group.name))).toEqual(['Walking', 'Running']);
  const report = JSON.parse((await page.locator('#asset-report').textContent())!);
  expect(report.authoredPreview).toBeUndefined();
  expect(await playingClips(page)).toEqual([]);
  await page.locator('#asset-play').click();
  await expect.poll(() => playingClips(page)).toEqual(['Walking']);
  expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBe(untouchedSave);
  expect(await page.evaluate(() => '__veylun' in window)).toBe(false);
  await info.attach('incompatible-idle-console.json', { body: JSON.stringify(errors, null, 2), contentType: 'application/json' });
  expect(errors).toEqual([]);
});

test('production loads the real Idle preview and controls it without development hooks', async ({ page }, info) => {
  const errors = collectErrors(page);
  await preserveSave(page);
  const requests: string[] = [];
  page.on('request', request => { if (/\.glb(?:\?|$)/.test(request.url())) requests.push(request.url()); });
  await page.goto('http://127.0.0.1:4173/?inspect=ruen&motion=idle-v1');
  await expect(page.locator('#asset-status')).toHaveAttribute('data-state', 'loaded', { timeout: 120000 });
  expect(requests).toHaveLength(1);
  expect(await page.evaluate(() => ({ inspector: '__assetInspector' in window, game: '__veylun' in window }))).toEqual({ inspector: false, game: false });
  await expect(page.locator('#asset-clip')).toHaveValue(idleName);
  await expect(page.locator('#asset-clip option:checked')).toHaveText('Idle neutro · prototipo v1 · 4.000 s');
  await expect(page.locator('#asset-playback')).toHaveText(`${idleName} · Pausado`);
  const report = JSON.parse((await page.locator('#asset-report').textContent())!);
  expect(report.animationGroups).toHaveLength(20);
  expect(report.authoredPreview).toMatchObject({ name: idleName, notInMaster: true, gameplayIntegrated: false });
  await page.locator('#asset-play').click();
  await expect(page.locator('#asset-playback')).toHaveText(`${idleName} · Reproduciendo`);
  for (const clip of ['Walking', 'Running', idleName]) {
    await page.locator('#asset-clip').selectOption(clip);
    await expect(page.locator('#asset-playback')).toHaveText(`${clip} · Reproduciendo`);
  }
  await page.locator('#asset-play').click();
  await expect(page.locator('#asset-playback')).toHaveText(`${idleName} · Pausado`);
  expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBe(untouchedSave);
  await info.attach('production-idle-console.json', { body: JSON.stringify(errors, null, 2), contentType: 'application/json' });
  expect(errors).toEqual([]);
});
