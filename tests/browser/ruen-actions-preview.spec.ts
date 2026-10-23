import { expect, test, type Page } from '@playwright/test';
import type { AssetInspector } from '../../src/inspection/AssetInspector';
import { SAVE_KEY } from '../../src/progression/save';

test.use({ baseURL: 'http://127.0.0.1:5174', viewport: { width: 800, height: 600 } });
test.setTimeout(360000);
type PreviewWindow = Window & { __assetInspector: AssetInspector };
const hurt = 'Ruen_Hurt_Equipped';
const actions = [
  { name: hurt, duration: .3, times: [0, .075, .18, .3], holdsEnd: false },
  { name: 'Ruen_Death_Equipped', duration: 1.25, times: [0, .1, .38, .65, .95, 1.05, 1.25], holdsEnd: true },
  { name: 'Ruen_Interact_Equipped', duration: .5, times: [0, .18, .3, .5], holdsEnd: false },
  { name: 'Ruen_Victory_Equipped', duration: 3, times: [0, .55, 1.4, 2.15, 2.55, 3], holdsEnd: true },
];
const directional = ['Walk', 'Run'].flatMap(gait => ['Left', 'Right', 'Back'].map(direction => ({
  name: `Ruen_${gait}_${direction}_Equipped`, duration: gait === 'Walk' ? .8 : .36,
  times: (gait === 'Walk' ? [0, .2, .4, .6, .8] : [0, .09, .18, .27, .36]), holdsEnd: false,
})));
const clips = [...actions, ...directional];
const authoredNames = [...['Idle', 'Walk', 'Run', 'Guard', 'Block', 'Attack1', 'Attack2', 'Attack3', 'Jump', 'Fall', 'Land', 'Roll']
  .map(name => `Ruen_${name}_Equipped`), ...clips.map(clip => clip.name)].sort();
const assetPaths = [
  '/assets/models/ruen/Meshy_AI_Crimson_Gemwarden_All_Animations.glb',
  '/assets/models/ruen/equipment/runtime/azure-oathblade.glb',
  '/assets/models/ruen/equipment/runtime/aegis-of-the-azure.glb',
].sort();
const preservedSave = 'actions-preview-must-not-change-the-adventure';

async function observe(page: Page) {
  const errors = { unhandled: [] as string[], console: [] as string[] }, requests: string[] = [];
  page.on('pageerror', error => errors.unhandled.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('request', request => { if (/\.glb(?:\?|$)/.test(request.url())) requests.push(new URL(request.url()).pathname); });
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: SAVE_KEY, value: preservedSave });
  return { errors, requests };
}

async function ready(page: Page) {
  await expect(page.locator('#asset-status')).toHaveAttribute('data-state', 'loaded', { timeout: 150000 });
  await expect(page.locator('#asset-equipment-status')).toHaveAttribute('data-state', 'ready', { timeout: 150000 });
  await expect(page.locator('#asset-clip')).toHaveValue(hurt);
  await expect(page.locator('#asset-playback')).toHaveText(`${hurt} · Pausado`);
  await expect(page.locator('#asset-equipment-toggle')).toBeChecked();
  const report = JSON.parse((await page.locator('#asset-report').textContent())!);
  expect(report.animationGroups).toHaveLength(20);
  expect(report.authoredPreview).toMatchObject({ stage: 'actions-v1', notInMaster: true, gameplayIntegrated: true });
  expect([...report.authoredPreview.clips].sort()).toEqual(authoredNames);
  expect(await page.locator('#asset-clip option').evaluateAll(options => options
    .filter(option => !(option as HTMLOptionElement).disabled).map(option => (option as HTMLOptionElement).value)))
    .toEqual(expect.arrayContaining(authoredNames));
}

async function originalDigest(page: Page) {
  return page.evaluate(() => {
    const model = (window as unknown as PreviewWindow).__assetInspector.model!;
    const source = JSON.stringify(model.report.animationGroups.map(original => {
      const group = model.container.animationGroups.find(group => group.name === original.name)!;
      return { ...original, from: group.from, to: group.to, tracks: group.targetedAnimations.map(({ target, animation }) => ({
        target: target.name, property: animation.targetProperty, fps: animation.framePerSecond, keys: animation.getKeys(),
      })) };
    }));
    let hash = 2166136261;
    for (let index = 0; index < source.length; index++) hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
    return { length: source.length, hash: hash >>> 0 };
  });
}

/** Sample actual geometry after paused seeks, not animation-key values. */
async function sampleClip(page: Page, times: number[]) {
  return page.evaluate(times => {
    const inspector = (window as unknown as PreviewWindow).__assetInspector;
    const model = inspector.model!, equipment = inspector.equipment!, group = model.player.current!;
    if (model.player.isPlaying) throw new Error('Pause the action before sampling its skin.');
    const meshes = model.container.meshes.filter(mesh => mesh.skeleton && mesh.getTotalVertices() > 0);
    const profiles = equipment.report.items;
    const transform = (point: readonly number[], matrix: ArrayLike<number>) => [
      point[0]! * matrix[0]! + point[1]! * matrix[4]! + point[2]! * matrix[8]! + matrix[12]!,
      point[0]! * matrix[1]! + point[1]! * matrix[5]! + point[2]! * matrix[9]! + matrix[13]!,
      point[0]! * matrix[2]! + point[1]! * matrix[6]! + point[2]! * matrix[10]! + matrix[14]!,
    ];
    const sample = (seconds: number) => {
      group.goToFrame(group.from + seconds * group.targetedAnimations[0]!.animation.framePerSecond);
      inspector.scene.render();
      const skin = meshes.map(mesh => Array.from(mesh.getPositionData(true, true)!));
      let minSkinWorldY = Infinity;
      skin.forEach((positions, index) => {
        const matrix = meshes[index]!.computeWorldMatrix(true).asArray();
        for (let vertex = 0; vertex < positions.length; vertex += 3) {
          minSkinWorldY = Math.min(minSkinWorldY, positions[vertex]! * matrix[1]! + positions[vertex + 1]! * matrix[5]! +
            positions[vertex + 2]! * matrix[9]! + matrix[13]!);
        }
      });
      return { seconds, frame: group.getCurrentFrame(), root: Array.from(model.root.computeWorldMatrix(true).asArray()), skin, minSkinWorldY,
        gear: equipment.models.map(item => {
          const profile = profiles.find(profile => profile.kind === item.kind)!;
          const hand = model.container.transformNodes.find(node => node.name === profile.hand)!;
          const grip = transform(profile.grip, item.model.root.computeWorldMatrix(true).asArray());
          const inHand = transform(grip, hand.computeWorldMatrix(true).clone().invert().asArray());
          return { kind: item.kind, enabled: item.mount.isEnabled(), parent: item.mount.parent?.name,
            linked: model.container.skeletons[0]!.bones.find(bone => bone.name === profile.hand)!.getTransformNode() === item.mount.parent,
            scale: item.mount.scaling.asArray(), gripError: Math.hypot(...inHand.map((value, axis) => value - profile.handOffset[axis]!)) };
        }) };
    };
    const compact = ({ seconds, frame, root, gear, minSkinWorldY }: ReturnType<typeof sample>) => ({ seconds, frame, root, gear, minSkinWorldY });
    const first = sample(times[0]!); let previous = first;
    const samples = [compact(first)];
    let maxSkinDelta = 0, terminalHoldDelta = 0, finite = first.skin.every(positions => positions.every(Number.isFinite));
    for (const seconds of times.slice(1)) {
      const current = sample(seconds); terminalHoldDelta = 0;
      finite &&= current.skin.every(positions => positions.every(Number.isFinite));
      current.skin.forEach((positions, mesh) => positions.forEach((value, index) => {
        maxSkinDelta = Math.max(maxSkinDelta, Math.abs(value - first.skin[mesh]![index]!));
        terminalHoldDelta = Math.max(terminalHoldDelta, Math.abs(value - previous.skin[mesh]![index]!));
      }));
      samples.push(compact(current)); previous = current;
    }
    return { name: group.name, duration: (group.to - group.from) / group.targetedAnimations[0]!.animation.framePerSecond,
      vertices: first.skin.reduce((sum, positions) => sum + positions.length / 3, 0), maxSkinDelta, terminalHoldDelta, finite,
      playing: model.container.animationGroups.filter(group => group.isPlaying).map(group => group.name), samples };
  }, times);
}

test('actions preview opens paused and deforms the real equipped skin while preserving ground and source clips', async ({ page }, info) => {
  const observed = await observe(page);
  await page.goto('/?inspect=ruen&motion=actions-v1&test=1');
  await ready(page);
  expect(observed.requests.sort()).toEqual(assetPaths);
  const initial = await page.evaluate(() => {
    const model = (window as unknown as PreviewWindow).__assetInspector.model!;
    return { groups: model.container.animationGroups.map(group => group.name), frame: model.player.current!.getCurrentFrame(),
      playing: model.container.animationGroups.filter(group => group.isPlaying).map(group => group.name) };
  });
  expect(initial.groups).toHaveLength(43);
  expect(new Set(initial.groups).size).toBe(43);
  expect(initial.frame).toBe(0);
  expect(initial.playing).toEqual([]);
  const original = await originalDigest(page);
  const samples: Awaited<ReturnType<typeof sampleClip>>[] = [];
  for (const clip of clips) {
    if (clip.name !== hurt) {
      await page.locator('#asset-clip').selectOption(clip.name);
      await expect(page.locator('#asset-playback')).toHaveText(`${clip.name} · Reproduciendo`);
      await page.locator('#asset-play').click();
    }
    const sample = await sampleClip(page, clip.times); samples.push(sample);
    expect(sample.name).toBe(clip.name);
    expect(sample.duration).toBeCloseTo(clip.duration, 6);
    expect(sample.vertices).toBeGreaterThan(0);
    expect(sample.finite).toBe(true);
    expect(sample.maxSkinDelta).toBeGreaterThan(1e-5);
    expect(sample.playing).toEqual([]);
    if (clip.holdsEnd) expect(sample.terminalHoldDelta).toBeLessThan(1e-6);
    for (const pose of sample.samples) {
      expect(pose.frame).toBeCloseTo(pose.seconds * 60, 5);
      expect(pose.root).toEqual(sample.samples[0]!.root);
      expect(pose.root.slice(12, 15)).toEqual([0, 0, 0]);
      expect(pose.minSkinWorldY, `${clip.name} skin at ${pose.seconds.toFixed(5)}s`).toBeGreaterThanOrEqual(-.01);
      expect(pose.gear).toHaveLength(2);
      for (const gear of pose.gear) {
        expect(gear.enabled && gear.linked).toBe(true);
        expect(gear.parent).toBe(gear.kind === 'sword' ? 'mixamorig:RightHand' : 'mixamorig:LeftHand');
        expect(gear.gripError).toBeLessThan(1e-5);
        gear.scale.forEach(value => expect(value).toBeCloseTo(gear.kind === 'sword' ? .55 : .294, 10));
      }
    }
    if (clip.name === 'Ruen_Death_Equipped') {
      await page.locator('#asset-view-side').click();
      await page.evaluate(() => (window as unknown as PreviewWindow).__assetInspector.scene.render());
      await page.locator('#renderCanvas').screenshot({ path: info.outputPath('ruen-actions-death-side.png') });
    }
  }
  await page.locator('#asset-clip').selectOption('Running');
  await expect(page.locator('#asset-equipment-toggle')).not.toBeChecked();
  expect(await page.evaluate(() => (window as unknown as PreviewWindow).__assetInspector.equipment!.models.every(item => !item.mount.isEnabled()))).toBe(true);
  expect(await originalDigest(page)).toEqual(original);
  expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBe(preservedSave);
  expect(await page.evaluate(() => '__veylun' in window)).toBe(false);
  await info.attach('actions-preview-evidence.json', { body: JSON.stringify({ ...observed, original, samples }, null, 2), contentType: 'application/json' });
  expect(observed.errors).toEqual({ unhandled: [], console: [] });
});

test('production actions preview offers its complete equipped catalog without development hooks or save changes', async ({ page }, info) => {
  const observed = await observe(page);
  await page.goto('http://127.0.0.1:4173/?inspect=ruen&motion=actions-v1&test=1');
  await ready(page);
  expect(observed.requests.sort()).toEqual(assetPaths);
  expect(await page.evaluate(() => ({ inspector: '__assetInspector' in window, game: '__veylun' in window }))).toEqual({ inspector: false, game: false });
  await page.locator('#asset-play').click();
  for (const clip of [actions[1]!, actions[2]!, actions[3]!, directional.at(-1)!]) {
    await page.locator('#asset-clip').selectOption(clip.name);
    await expect(page.locator('#asset-playback')).toHaveText(`${clip.name} · Reproduciendo`);
    await expect(page.locator('#asset-equipment-toggle')).toBeChecked();
  }
  await page.locator('#asset-play').click();
  await expect(page.locator('#asset-playback')).toHaveText('Ruen_Run_Back_Equipped · Pausado');
  await page.locator('#asset-equipment-toggle').uncheck();
  await expect(page.locator('#asset-playback')).toHaveText('Ruen_Idle_v1 · Pausado');
  expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBe(preservedSave);
  await info.attach('production-actions-preview-console.json', { body: JSON.stringify(observed, null, 2), contentType: 'application/json' });
  expect(observed.errors).toEqual({ unhandled: [], console: [] });
});
