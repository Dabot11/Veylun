import { expect, test, type Page } from '@playwright/test';
import type { AssetInspector } from '../../src/inspection/AssetInspector';
import { SAVE_KEY } from '../../src/progression/save';

test.use({ baseURL: 'http://127.0.0.1:5174', viewport: { width: 800, height: 600 } });
test.setTimeout(360000);

type PreviewWindow = Window & { __assetInspector: AssetInspector };
const guard = 'Ruen_Guard_Equipped';
const clips = [
  { name: guard, duration: 4, sampleFraction: .5 },
  { name: 'Ruen_Block_Equipped', duration: .22, sampleFraction: 1 / 3 },
  { name: 'Ruen_Attack1_Equipped', duration: .48, sampleFraction: .5 },
  { name: 'Ruen_Attack2_Equipped', duration: .5, sampleFraction: .5 },
  { name: 'Ruen_Attack3_Equipped', duration: .63, sampleFraction: .5 },
];
const assetPaths = [
  '/assets/models/ruen/Meshy_AI_Crimson_Gemwarden_All_Animations.glb',
  '/assets/models/ruen/equipment/runtime/azure-oathblade.glb',
  '/assets/models/ruen/equipment/runtime/aegis-of-the-azure.glb',
].sort();
const preservedSave = 'combat-preview-must-not-change-the-adventure';

async function observePage(page: Page) {
  const errors = { unhandled: [] as string[], console: [] as string[] };
  const requests: string[] = [];
  page.on('pageerror', error => errors.unhandled.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('request', request => { if (/\.glb(?:\?|$)/.test(request.url())) requests.push(request.url()); });
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: SAVE_KEY, value: preservedSave });
  return { errors, requests };
}

async function ready(page: Page) {
  await expect(page.locator('#asset-status')).toHaveAttribute('data-state', 'loaded', { timeout: 150000 });
  await expect(page.locator('#asset-equipment-status')).toHaveAttribute('data-state', 'ready', { timeout: 150000 });
  await expect(page.locator('#asset-clip')).toHaveValue(guard);
  await expect(page.locator('#asset-equipment-toggle')).toBeChecked();
  await expect(page.locator('#asset-playback')).toHaveText(`${guard} · Pausado`);
}

async function originalFingerprint(page: Page) {
  return page.evaluate(() => {
    const model = (window as unknown as PreviewWindow).__assetInspector.model!;
    return model.report.animationGroups.map(original => {
      const group = model.container.animationGroups.find(group => group.name === original.name)!;
      const data = JSON.stringify(group.targetedAnimations.map(({ target, animation }) => ({
        target: target.name, property: animation.targetProperty, fps: animation.framePerSecond, keys: animation.getKeys(),
      })));
      let hash = 2166136261;
      for (let index = 0; index < data.length; index++) hash = Math.imul(hash ^ data.charCodeAt(index), 16777619);
      return { name: group.name, from: group.from, to: group.to, tracks: group.targetedAnimations.length, hash: hash >>> 0 };
    });
  });
}

/** Paused seeking measures actual skinned vertices, independently of software-renderer speed. */
async function sampleClip(page: Page, fraction: number) {
  return page.evaluate(fraction => {
    const inspector = (window as unknown as PreviewWindow).__assetInspector;
    const model = inspector.model!, equipment = inspector.equipment!, group = model.player.current!;
    if (model.player.isPlaying) throw new Error('Pause the clip before sampling its geometry.');
    const meshes = model.container.meshes.filter(mesh => mesh.skeleton && mesh.getTotalVertices() > 0);
    const profiles = equipment.report.items;
    const transform = (point: readonly number[], matrix: ArrayLike<number>) => [
      point[0]! * matrix[0]! + point[1]! * matrix[4]! + point[2]! * matrix[8]! + matrix[12]!,
      point[0]! * matrix[1]! + point[1]! * matrix[5]! + point[2]! * matrix[9]! + matrix[13]!,
      point[0]! * matrix[2]! + point[1]! * matrix[6]! + point[2]! * matrix[10]! + matrix[14]!,
    ];
    const sample = (at: number) => {
      group.goToFrame(group.from + (group.to - group.from) * at);
      inspector.scene.render();
      return {
        frame: group.getCurrentFrame(),
        skin: meshes.map(mesh => Array.from(mesh.getPositionData(true, true)!)),
        gear: equipment.models.map(item => {
          const profile = profiles.find(profile => profile.kind === item.kind)!;
          const hand = model.container.transformNodes.find(node => node.name === profile.hand)!;
          const gripWorld = transform(profile.grip, item.model.root.computeWorldMatrix(true).asArray());
          return {
            kind: item.kind, enabled: item.mount.isEnabled(), parent: item.mount.parent?.name,
            linked: model.container.skeletons[0]!.bones.find(bone => bone.name === profile.hand)!.getTransformNode() === item.mount.parent,
            gripInHand: transform(gripWorld, hand.computeWorldMatrix(true).clone().invert().asArray()),
            expectedGrip: [...profile.handOffset], scale: item.mount.scaling.asArray(),
          };
        }),
      };
    };
    const first = sample(0), second = sample(fraction);
    let maxSkinDelta = 0, changedCoordinates = 0;
    const finite = [...first.skin, ...second.skin].every(positions => positions.length > 0 && positions.every(Number.isFinite));
    second.skin.forEach((positions, mesh) => positions.forEach((value, index) => {
      const delta = Math.abs(value - first.skin[mesh]![index]!);
      maxSkinDelta = Math.max(maxSkinDelta, delta);
      if (delta > 1e-5) changedCoordinates++;
    }));
    return {
      name: group.name, duration: (group.to - group.from) / group.targetedAnimations[0]!.animation.framePerSecond,
      skinnedMeshes: meshes.length, vertices: first.skin.reduce((sum, positions) => sum + positions.length / 3, 0),
      finite, maxSkinDelta, changedCoordinates,
      samples: [first, second].map(({ frame, gear }) => ({ frame, gear })),
      playing: model.container.animationGroups.filter(group => group.isPlaying).map(group => group.name),
    };
  }, fraction);
}

test('combat preview opens paused and deforms the real skin with five independent equipped clips', async ({ page }, info) => {
  const { errors, requests } = await observePage(page);
  // Combat mode itself requests equipment; no separate equipment query is needed.
  await page.goto('/?inspect=ruen&motion=combat-v1&test=1');
  await ready(page);
  expect(requests.map(url => new URL(url).pathname).sort()).toEqual(assetPaths);
  const inventory = await page.evaluate(() => {
    const model = (window as unknown as PreviewWindow).__assetInspector.model!;
    return {
      originals: model.report.animationGroups,
      groups: model.container.animationGroups.map(group => group.name),
      playing: model.container.animationGroups.filter(group => group.isPlaying).map(group => group.name),
      frame: model.player.current!.getCurrentFrame(),
    };
  });
  expect(inventory.originals).toHaveLength(20);
  expect(inventory.groups).toHaveLength(29);
  expect(new Set(inventory.groups).size).toBe(29);
  expect(inventory.playing).toEqual([]);
  expect(inventory.frame).toBe(0);
  const originalsBefore = await originalFingerprint(page);
  const exported = JSON.parse((await page.locator('#asset-report').textContent())!);
  expect(exported.animationGroups).toEqual(inventory.originals);
  expect(exported.authoredPreview).toMatchObject({ stage: 'combat-v1', notInMaster: true, gameplayIntegrated: true });
  expect(exported.authoredPreview.clips).toEqual(expect.arrayContaining(clips.map(clip => clip.name)));
  expect(exported.equipmentPreview.items.map((item: { path: string }) => `/${item.path}`).sort()).toEqual(assetPaths.filter(path => path.includes('/runtime/')));

  const evidence: Awaited<ReturnType<typeof sampleClip>>[] = [];
  for (const clip of clips) {
    if (clip.name !== guard) {
      await page.locator('#asset-clip').selectOption(clip.name);
      await expect(page.locator('#asset-playback')).toHaveText(`${clip.name} · Reproduciendo`);
      await page.locator('#asset-play').click();
    }
    const sample = await sampleClip(page, clip.sampleFraction);
    evidence.push(sample);
    expect(sample.name).toBe(clip.name);
    expect(sample.duration).toBeCloseTo(clip.duration, 6);
    expect(sample.skinnedMeshes).toBeGreaterThan(0);
    expect(sample.vertices).toBeGreaterThan(0);
    expect(sample.finite).toBe(true);
    expect(sample.maxSkinDelta).toBeGreaterThan(1e-5);
    expect(sample.changedCoordinates).toBeGreaterThan(0);
    expect(sample.playing).toEqual([]);
    for (const pose of sample.samples) {
      expect(pose.gear).toHaveLength(2);
      for (const gear of pose.gear) {
        expect(gear.enabled).toBe(true);
        expect(gear.parent).toBe(gear.kind === 'sword' ? 'mixamorig:RightHand' : 'mixamorig:LeftHand');
        expect(gear.linked).toBe(true);
        gear.scale.forEach(value => expect(value).toBeCloseTo(gear.kind === 'sword' ? .55 : .294, 10));
        gear.gripInHand.forEach((value, index) => expect(value).toBeCloseTo(gear.expectedGrip[index]!, 5));
      }
    }
  }

  await page.locator('#asset-clip').selectOption('Running');
  await expect(page.locator('#asset-equipment-toggle')).not.toBeChecked();
  expect(await page.evaluate(() => {
    const inspector = (window as unknown as PreviewWindow).__assetInspector;
    return { playing: inspector.model!.container.animationGroups.filter(group => group.isPlaying).map(group => group.name),
      equipment: inspector.equipment!.models.map(item => item.mount.isEnabled()) };
  })).toEqual({ playing: ['Running'], equipment: [false, false] });
  await page.locator('#asset-clip').selectOption(guard);
  await page.locator('#asset-play').click();
  await sampleClip(page, .5);
  for (const view of ['front', 'side']) {
    await page.locator(`#asset-view-${view}`).click();
    await page.evaluate(() => (window as unknown as PreviewWindow).__assetInspector.scene.render());
    await page.locator('#renderCanvas').screenshot({ path: info.outputPath(`ruen-combat-guard-${view}.png`) });
  }
  expect(await originalFingerprint(page)).toEqual(originalsBefore);
  expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBe(preservedSave);
  expect(await page.evaluate(() => '__veylun' in window)).toBe(false);
  await info.attach('combat-preview-evidence.json', { body: JSON.stringify({ inventory, exported, evidence, requests }, null, 2), contentType: 'application/json' });
  await info.attach('combat-preview-console.json', { body: JSON.stringify(errors, null, 2), contentType: 'application/json' });
  expect(errors).toEqual({ unhandled: [], console: [] });
});

test('production combat preview exposes its clips and comparison controls without development hooks', async ({ page }, info) => {
  const { errors, requests } = await observePage(page);
  await page.goto('http://127.0.0.1:4173/?inspect=ruen&motion=combat-v1&equipment=azure&test=1');
  await ready(page);
  expect(requests.map(url => new URL(url).pathname).sort()).toEqual(assetPaths);
  expect(await page.evaluate(() => ({ inspector: '__assetInspector' in window, game: '__veylun' in window }))).toEqual({ inspector: false, game: false });
  const report = JSON.parse((await page.locator('#asset-report').textContent())!);
  expect(report.animationGroups).toHaveLength(20);
  expect(report.authoredPreview).toMatchObject({ stage: 'combat-v1', notInMaster: true, gameplayIntegrated: true });
  for (const clip of clips) await expect(page.locator(`#asset-clip option[value="${clip.name}"]`)).toBeEnabled();
  await page.locator('#asset-play').click();
  await expect(page.locator('#asset-playback')).toHaveText(`${guard} · Reproduciendo`);
  await page.locator('#asset-clip').selectOption('Ruen_Attack3_Equipped');
  await expect(page.locator('#asset-equipment-toggle')).toBeChecked();
  await expect(page.locator('#asset-playback')).toHaveText('Ruen_Attack3_Equipped · Reproduciendo');
  await page.locator('#asset-speed').evaluate((input: HTMLInputElement) => {
    input.value = '0.5'; input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#asset-speed-label')).toHaveText('0.5×');
  await page.locator('#asset-clip').selectOption('Running');
  await expect(page.locator('#asset-equipment-toggle')).not.toBeChecked();
  await page.locator('#asset-clip').selectOption(guard);
  await page.locator('#asset-play').click();
  await expect(page.locator('#asset-playback')).toHaveText(`${guard} · Pausado`);
  expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBe(preservedSave);
  await info.attach('production-combat-preview-console.json', { body: JSON.stringify({ errors, requests }, null, 2), contentType: 'application/json' });
  expect(errors).toEqual({ unhandled: [], console: [] });
});
