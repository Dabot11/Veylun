import { test, expect, type Page } from '@playwright/test';
import { inspectionGlb } from '../fixtures/inspection-glb';
import { SAVE_KEY } from '../../src/progression/save';

// These are loader/UI regressions against a synthetic fixture, never acceptance of Meshy art.
test.setTimeout(90000);
const inspectorUrl = 'http://127.0.0.1:5174/?inspect=ruen&test';
type InspectorWindow = Window & {
  __assetInspector?: {
    model?: {
      container: { animationGroups: { name: string; isPlaying: boolean; speedRatio: number }[] };
      root: { rotation: { y: number } };
    };
    camera: { alpha: number; beta: number };
  };
};

async function uploadFixture(page: Page): Promise<void> {
  await page.locator('#asset-file').setInputFiles({
    name: 'synthetic-inspection-fixture.glb', mimeType: 'model/gltf-binary', buffer: inspectionGlb(),
  });
  await expect(page.locator('#asset-clip')).toBeEnabled({ timeout: 45000 });
  await expect(page.locator('#asset-report')).toContainText('SyntheticSkeleton');
}

async function playingClips(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as InspectorWindow).__assetInspector?.model?.container.animationGroups
    .filter(group => group.isPlaying).map(group => group.name) ?? []);
}

test('inspector stays isolated, loads a synthetic skin, and plays one clip at a time', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const modelRequests: string[] = [];
  page.on('request', request => { if (/\.glb(?:\?|$)/.test(request.url())) modelRequests.push(request.url()); });
  const untouchedSave = 'untouched-by-inspector';
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: SAVE_KEY, value: untouchedSave });
  await page.goto(inspectorUrl);
  await expect(page.locator('#asset-inspector')).toBeVisible();
  await expect(page.locator('#asset-clip')).toBeDisabled();
  expect(modelRequests).toEqual([]);
  expect(await page.evaluate(() => '__veylun' in window)).toBe(false);
  await uploadFixture(page);
  expect(await playingClips(page)).toEqual([]);
  await expect(page.locator('#asset-clip')).toHaveValue('Walking');
  await expect(page.locator('#asset-report')).toContainText('SyntheticSkinnedPanel');
  await expect(page.locator('#asset-report')).toContainText('SyntheticCoralMaterial');
  await expect(page.locator('#asset-report')).toContainText('KHR_materials_ior');
  await page.locator('#asset-play').click();
  await expect.poll(() => playingClips(page)).toEqual(['Walking']);
  await page.locator('#asset-clip').selectOption('Running');
  await expect.poll(() => playingClips(page)).toEqual(['Running']);
  await page.locator('#asset-speed').evaluate((input: HTMLInputElement) => {
    input.value = '1.5';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect.poll(() => page.evaluate(() => (window as InspectorWindow).__assetInspector?.model?.container.animationGroups
    .find(group => group.name === 'Running')?.speedRatio)).toBe(1.5);
  await page.locator('#asset-play').click();
  await expect.poll(() => playingClips(page)).toEqual([]);
  await page.locator('#asset-view-front').click();
  const front = await page.evaluate(() => (window as InspectorWindow).__assetInspector?.camera.alpha);
  await page.locator('#asset-view-side').click();
  const side = await page.evaluate(() => (window as InspectorWindow).__assetInspector?.camera.alpha);
  await page.locator('#asset-view-back').click();
  const back = await page.evaluate(() => (window as InspectorWindow).__assetInspector?.camera.alpha);
  expect(front).not.toBe(side);
  expect(front).not.toBe(back);
  expect(side).not.toBe(back);
  await page.getByText('Escala y orientación exteriores', { exact: true }).click();
  await page.locator('#asset-yaw').fill('90');
  await page.locator('#asset-yaw').dispatchEvent('change');
  await expect.poll(() => page.evaluate(() => (window as InspectorWindow).__assetInspector?.model?.root.rotation.y)).toBe(Math.PI / 2);
  await page.locator('#asset-yaw').fill('999');
  await page.locator('#asset-yaw').dispatchEvent('change');
  await expect(page.locator('#asset-yaw')).toHaveValue('90');
  expect(await page.evaluate(() => (window as InspectorWindow).__assetInspector?.model?.root.rotation.y)).toBe(Math.PI / 2);
  // Re-selecting exactly the same file must reload rather than leave the previous clip/transform.
  await uploadFixture(page);
  await expect(page.locator('#asset-clip')).toHaveValue('Walking');
  await expect(page.locator('#asset-yaw')).toHaveValue('0');
  expect(await playingClips(page)).toEqual([]);
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.locator('#asset-inspector').evaluate(panel => { panel.scrollTop = 0; });
  await page.screenshot({ path: testInfo.outputPath('synthetic-fixture-inspector.png'), fullPage: true });
  await testInfo.attach('synthetic-fixture-console-errors.json', { body: JSON.stringify(errors, null, 2), contentType: 'application/json' });
  expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBe(untouchedSave);
  expect(errors).toEqual([]);
});

test('bad local GLB reports failure and allows a later real loader retry with the synthetic fixture', async ({ page }, testInfo) => {
  const unhandled: string[] = [];
  const expectedConsoleErrors: string[] = [];
  page.on('pageerror', error => unhandled.push(error.message));
  page.on('console', message => { if (message.type() === 'error') expectedConsoleErrors.push(message.text()); });
  await page.goto(inspectorUrl);
  await page.locator('#asset-file').setInputFiles({
    name: 'invalid.glb', mimeType: 'model/gltf-binary', buffer: Buffer.from('not a GLB'),
  });
  await expect(page.locator('#asset-status')).toContainText(/no se pudo|error|fall[oó]|inv[aá]lido/i, { timeout: 30000 });
  await expect(page.locator('#asset-clip')).toBeDisabled();
  await uploadFixture(page);
  await page.locator('#asset-play').click();
  await expect.poll(() => playingClips(page)).toEqual(['Walking']);
  await testInfo.attach('invalid-glb-expected-console-errors.json', {
    body: JSON.stringify({ expectedConsoleErrors, unhandled }, null, 2), contentType: 'application/json',
  });
  expect(expectedConsoleErrors.some(message => message.includes('carga fallida'))).toBe(true);
  expect(unhandled).toEqual([]);
});

test('production inspector loads the repository URL through Babylon with a synthetic response, without autoplay', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  let requested = 0;
  // Only the transport URL is the real asset path; the response is explicitly NOT the Meshy master.
  await page.route('**/assets/models/ruen/Meshy_AI_Crimson_Gemwarden_All_Animations.glb', async route => {
    requested++;
    await route.fulfill({ contentType: 'model/gltf-binary', body: inspectionGlb() });
  });
  await page.goto('/?inspect=ruen');
  await expect(page.locator('#asset-inspector')).toBeVisible();
  expect(requested).toBe(0);
  await page.locator('#asset-load-default').click();
  await expect(page.locator('#asset-status')).toHaveAttribute('data-state', 'loaded', { timeout: 45000 });
  expect(requested).toBe(1);
  await expect(page.locator('#asset-report')).toContainText('SyntheticSkeleton');
  await expect(page.locator('#asset-report')).toContainText('SyntheticCoralMaterial');
  await expect(page.locator('#asset-clip')).toHaveValue('Walking');
  await expect(page.locator('#asset-play')).toHaveText('Reproducir');
  await expect(page.locator('#asset-playback')).toHaveText('Walking · Pausado');
  expect(await page.evaluate(() => '__assetInspector' in window)).toBe(false);
  await page.locator('#asset-play').click();
  await expect(page.locator('#asset-playback')).toHaveText('Walking · Reproduciendo');
  await page.locator('#asset-clip').selectOption('Running');
  await expect(page.locator('#asset-playback')).toHaveText('Running · Reproduciendo');
  await page.locator('#asset-play').click();
  await expect(page.locator('#asset-playback')).toHaveText('Running · Pausado');
  await testInfo.attach('production-synthetic-response-console-errors.json', { body: JSON.stringify(errors, null, 2), contentType: 'application/json' });
  expect(errors).toEqual([]);
});
