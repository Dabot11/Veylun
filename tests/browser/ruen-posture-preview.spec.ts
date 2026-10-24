import { expect, test, type Page } from '@playwright/test';
import type { AssetInspector } from '../../src/inspection/AssetInspector';
import { SAVE_KEY } from '../../src/progression/save';

test.use({ baseURL: 'http://127.0.0.1:5174', viewport: { width: 800, height: 600 } });
test.setTimeout(240000);
type PreviewWindow = Window & { __assetInspector: AssetInspector };
const idle = 'Ruen_Idle_Equipped', guard = 'Ruen_Guard_Equipped', block = 'Ruen_Block_Equipped';
const preservedSave = 'posture-preview-must-preserve-the-adventure';

async function observe(page: Page) {
  const errors = { unhandled: [] as string[], console: [] as string[] };
  page.on('pageerror', error => errors.unhandled.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()); });
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: SAVE_KEY, value: preservedSave });
  return errors;
}
async function ready(page: Page) {
  await expect(page.locator('#asset-status')).toHaveAttribute('data-state', 'loaded', { timeout: 150000 });
  await expect(page.locator('#asset-equipment-status')).toHaveAttribute('data-state', 'ready', { timeout: 150000 });
  await expect(page.locator('#asset-clip')).toHaveValue(idle);
  await expect(page.locator('#asset-playback')).toHaveText(`${idle} · Pausado`);
  await expect(page.locator('#asset-equipment-toggle')).toBeChecked();
  const report = JSON.parse((await page.locator('#asset-report').textContent())!);
  expect(report.animationGroups).toHaveLength(20);
  expect(report.authoredPreview).toMatchObject({ stage: 'posture-v1', gameplayIntegrated: true, notInMaster: true });
  expect(report.authoredPreview.clips).toHaveLength(22);
}
async function selectPaused(page: Page, name: string) {
  // Selecting a clip starts playback in the inspector. Pause through its real
  // control before taking deterministic skin samples or testing Play again.
  await page.locator('#asset-clip').selectOption(name);
  await expect(page.locator('#asset-playback')).toHaveText(`${name} · Reproduciendo`);
  await page.locator('#asset-play').click();
  await expect(page.locator('#asset-playback')).toHaveText(`${name} · Pausado`);
}
async function sourceDigest(page: Page) {
  return page.evaluate(() => {
    const model = (window as unknown as PreviewWindow).__assetInspector.model!;
    const data = JSON.stringify(model.report.animationGroups.map(original => {
      const group = model.container.animationGroups.find(group => group.name === original.name)!;
      return group.targetedAnimations.map(({ target, animation }) => ({ name: target.name, fps: animation.framePerSecond,
        property: animation.targetProperty, keys: animation.getKeys() }));
    }));
    let hash = 2166136261;
    for (let i = 0; i < data.length; i++) hash = Math.imul(hash ^ data.charCodeAt(i), 16777619);
    return { length: data.length, hash: hash >>> 0 };
  });
}

async function sample(page: Page, seconds: number[]) {
  return page.evaluate(seconds => {
    const inspector = (window as unknown as PreviewWindow).__assetInspector, model = inspector.model!, equipment = inspector.equipment!;
    const group = model.player.current!, fps = group.targetedAnimations[0]!.animation.framePerSecond;
    if (model.player.isPlaying) throw new Error('Posture samples must be paused.');
    const transform = (p: readonly number[], m: ArrayLike<number>) => [
      p[0]! * m[0]! + p[1]! * m[4]! + p[2]! * m[8]! + m[12]!,
      p[0]! * m[1]! + p[1]! * m[5]! + p[2]! * m[9]! + m[13]!,
      p[0]! * m[2]! + p[1]! * m[6]! + p[2]! * m[10]! + m[14]!,
    ];
    const body = model.container.meshes.filter(mesh => mesh.skeleton && mesh.getTotalVertices() > 0);
    const read = (time: number) => {
      group.goToFrame(group.from + time * fps); inspector.scene.render();
      const skin = body.map(mesh => Array.from(mesh.getPositionData(true, true)!));
      let floor = Infinity;
      skin.forEach((positions, index) => {
        const matrix = body[index]!.computeWorldMatrix(true).asArray();
        for (let offset = 0; offset < positions.length; offset += 3) floor = Math.min(floor, transform(positions.slice(offset, offset + 3), matrix)[1]!);
      });
      const joints = Object.fromEntries(model.container.transformNodes.filter(node => /^mixamorig:(Hips|Spine1|Spine2|LeftFoot|RightFoot|LeftToeBase|RightToeBase|LeftToe_End|RightToe_End)$/.test(node.name))
        .map(node => [node.name, node.computeWorldMatrix(true).getTranslation().asArray()]));
      const gear = equipment.models.map(item => {
        const profile = equipment.report.items.find(p => p.kind === item.kind)!;
        const hand = model.container.transformNodes.find(node => node.name === profile.hand)!;
        const grip = transform(profile.grip, item.model.root.computeWorldMatrix(true).asArray());
        const local = transform(grip, hand.computeWorldMatrix(true).clone().invert().asArray());
        let minY = Infinity;
        for (const mesh of item.model.container.meshes) {
          if (!mesh.getTotalVertices()) continue;
          const vertices = mesh.getPositionData(true, true)!, matrix = mesh.computeWorldMatrix(true).asArray();
          for (let offset = 0; offset < vertices.length; offset += 3) minY = Math.min(minY,
            vertices[offset]! * matrix[1]! + vertices[offset + 1]! * matrix[5]! + vertices[offset + 2]! * matrix[9]! + matrix[13]!);
        }
        return { kind: item.kind, parent: item.mount.parent?.name, enabled: item.mount.isEnabled(), scale: item.mount.scaling.asArray(),
          gripError: Math.hypot(...local.map((value, index) => value - profile.handOffset[index]!)), minY };
      });
      return { time, frame: group.getCurrentFrame(), joints, gear, floor, skin, root: model.root.computeWorldMatrix(true).asArray() };
    };
    const first = read(seconds[0]!); let maxSkinDelta = 0, loopDelta = 0;
    const compact = ({ skin: _skin, ...rest }: ReturnType<typeof read>) => rest;
    const samples = [compact(first)];
    for (const time of seconds.slice(1)) {
      const current = read(time); loopDelta = 0;
      current.skin.forEach((vertices, mesh) => vertices.forEach((value, index) => {
        const delta = Math.abs(value - first.skin[mesh]![index]!); maxSkinDelta = Math.max(maxSkinDelta, delta); loopDelta = Math.max(loopDelta, delta);
      }));
      samples.push(compact(current));
    }
    return { name: group.name, samples, maxSkinDelta, loopDelta, vertices: first.skin.reduce((sum, vertices) => sum + vertices.length / 3, 0) };
  }, seconds);
}

test('posture preview keeps natural Idle and guard grounded, equipped and looping on the real skin', async ({ page }, info) => {
  const errors = await observe(page);
  await page.goto('/?inspect=ruen&motion=posture-v1&test=1'); await ready(page);
  const original = await sourceDigest(page);
  expect(await page.evaluate(() => (window as unknown as PreviewWindow).__assetInspector.model!.container.animationGroups.length)).toBe(43);
  const evidence = [];
  for (const name of [idle, guard]) {
    await selectPaused(page, name);
    const data = await sample(page, [0, .5, 1, 2, 3, 4]); evidence.push(data);
    expect(data.vertices).toBeGreaterThan(50000); expect(data.maxSkinDelta).toBeGreaterThan(.001); expect(data.loopDelta).toBeLessThan(1e-5);
    const first = data.samples[0]!;
    for (const current of data.samples) {
      expect(current.floor).toBeGreaterThan(-.01); expect(current.root).toEqual(first.root);
      expect(current.frame).toBeCloseTo(current.time * (name === idle ? 30 : 60), 5);
      for (const [joint, position] of Object.entries(current.joints)) if (/Foot|Toe/.test(joint)) {
        expect(Math.hypot(...position.map((value, index) => value - first.joints[joint]![index]!)), joint).toBeLessThan(.001);
      }
      for (const gear of current.gear) {
        expect(gear.enabled).toBe(true); expect(gear.parent).toBe(gear.kind === 'sword' ? 'mixamorig:RightHand' : 'mixamorig:LeftHand');
        expect(gear.gripError).toBeLessThan(1e-4); expect(gear.minY).toBeGreaterThan(-.01);
        gear.scale.forEach(scale => expect(scale).toBeCloseTo(gear.kind === 'sword' ? .55 : .294, 8));
      }
    }
    await sample(page, [0]);
    for (const view of ['front', 'side', 'back']) {
      await page.locator(`#asset-view-${view}`).click();
      await page.evaluate(() => (window as unknown as PreviewWindow).__assetInspector.scene.render());
      await page.locator('#renderCanvas').screenshot({ path: info.outputPath(`${name}-${view}.png`) });
    }
  }
  await selectPaused(page, block);
  const blocked = await sample(page, [0, .07, .22]); evidence.push(blocked);
  expect(blocked.maxSkinDelta).toBeGreaterThan(.01); expect(blocked.loopDelta).toBeLessThan(1e-5);
  await selectPaused(page, idle);
  await page.locator('#asset-play').click(); await expect(page.locator('#asset-playback')).toHaveText(`${idle} · Reproduciendo`);
  await page.locator('#asset-play').click(); await expect(page.locator('#asset-playback')).toHaveText(`${idle} · Pausado`);
  expect(await sourceDigest(page)).toEqual(original);
  expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBe(preservedSave);
  await info.attach('posture-preview-evidence.json', { body: JSON.stringify({ evidence, original, errors }, null, 2), contentType: 'application/json' });
  expect(errors).toEqual({ unhandled: [], console: [] });
});

test('production posture preview opens the relaxed Idle and offers guard without debug hooks or save writes', async ({ page }, info) => {
  const errors = await observe(page);
  await page.goto('http://127.0.0.1:4173/?inspect=ruen&motion=posture-v1&test=1'); await ready(page);
  expect(await page.evaluate(() => ({ inspector: '__assetInspector' in window, game: '__veylun' in window }))).toEqual({ inspector: false, game: false });
  await page.locator('#asset-play').click();
  await page.locator('#asset-clip').selectOption(guard); await expect(page.locator('#asset-playback')).toHaveText(`${guard} · Reproduciendo`);
  await page.locator('#asset-clip').selectOption(block); await expect(page.locator('#asset-playback')).toHaveText(`${block} · Reproduciendo`);
  await page.locator('#asset-play').click(); await expect(page.locator('#asset-playback')).toHaveText(`${block} · Pausado`);
  await page.locator('#asset-equipment-toggle').uncheck(); await expect(page.locator('#asset-clip')).toHaveValue('Ruen_Idle_v1');
  expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBe(preservedSave);
  await info.attach('posture-preview-production-console.json', { body: JSON.stringify(errors, null, 2), contentType: 'application/json' });
  expect(errors).toEqual({ unhandled: [], console: [] });
});
