import { expect as baseExpect, test } from '@playwright/test';
import './harness';

const expect=baseExpect.configure({timeout:30000});
// Input/damage tests use a smaller software-rendered viewport. Art captures and
// the production bootstrap separately cover larger viewports with shadows on.
test.use({ baseURL: 'http://127.0.0.1:5174', viewport: { width: 640, height: 480 } });
// SwiftShader can spend most of a minute on scene startup and rendered HUD reads.
// Preserve every damage assertion while allowing all three input edges to finish.
test.setTimeout(180000);

for (const device of ['keyboard', 'mouse', 'gamepad'] as const) {
  test(`${device}: three real attack presses hit and defeat a nearby enemy`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    if (device === 'gamepad') {
      await page.addInitScript(() => {
        const pad = {
          id: 'Xbox combat regression', index: 0, connected: true, mapping: 'standard',
          axes: [0, 0, 0, 0], timestamp: 0,
          buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
        };
        Object.assign(window, { combatPad: pad });
        Object.defineProperty(navigator, 'getGamepads', { value: () => [pad] });
      });
    }
    await page.goto('/?test=1');
    await expect(page.locator('body')).toHaveAttribute('data-engine', 'ready', { timeout: 60000 });
    await page.getByRole('button', { name: 'Nueva partida' }).click();
    // Controlled encounter, with enemy AI waiting while real browser input drives
    // all attacks and damage. No health is removed through the test fixture.
    await page.evaluate(() => {
      const game = window.__veylun.sim;
      Object.assign(game.player, { x: -2, z: 26.5, y: 0, yaw: 0, vx: 0, vz: 0 });
      Object.assign(game.enemies[0]!, { x: -2, z: 28, state: 'recover', timer: -10 });
      window.__veylun.camera.reset(game);
    });
    async function attack(): Promise<void> {
      if (device === 'keyboard') await page.keyboard.press('KeyJ');
      else if (device === 'mouse') await page.mouse.click(400, 300);
      else {
        await page.evaluate(() => {
          const pad = (window as unknown as { combatPad: { buttons: { pressed: boolean; value: number }[] } }).combatPad;
          Object.assign(pad.buttons[2]!, { pressed: true, value: 1 });
        });
        await page.waitForTimeout(180);
        await page.evaluate(() => {
          const pad = (window as unknown as { combatPad: { buttons: { pressed: boolean; value: number }[] } }).combatPad;
          Object.assign(pad.buttons[2]!, { pressed: false, value: 0 });
        });
        await page.waitForTimeout(180);
      }
    }
    await attack();
    await expect.poll(() => page.evaluate(() => window.__veylun.sim.enemies[0]!.hp), { timeout: 15000 }).toBe(2);
    await expect(page.locator('#enemy-status')).toBeVisible();
    await expect(page.locator('.enemy-health')).toHaveText('2 / 3');
    await expect(page.getByRole('progressbar', { name: 'Vida del enemigo' })).toHaveAttribute('aria-valuenow', '2');
    await expect(page.locator('#combat-notice')).toContainText('Impacto · −1');
    await attack();
    await expect.poll(() => page.evaluate(() => window.__veylun.sim.enemies[0]!.hp), { timeout: 15000 }).toBe(1);
    await attack();
    await expect.poll(() => page.evaluate(() => window.__veylun.sim.enemies[0]!.hp), { timeout: 15000 }).toBe(0);
    await expect(page.locator('.enemy-state')).toHaveText('Purificado');
    expect(await page.evaluate(() => window.__veylun.sim.save.defeatedOrdinaryEnemies)).toContain('sprout-1');
    expect(errors).toEqual([]);
  });
}

test('active Brote: lock, block the charge, then counterattack without losing health', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?test=1');
  await expect(page.locator('body')).toHaveAttribute('data-engine', 'ready', { timeout: 60000 });
  await page.getByRole('button', { name: 'Nueva partida' }).click();
  // Move to the encounter; both enemies retain their normal AI and health.
  await page.evaluate(() => {
    const game = window.__veylun.sim;
    Object.assign(game.player, { x: -2, z: 26, y: 0, yaw: 0, vx: 0, vz: 0 });
    window.__veylun.camera.reset(game);
  });
  await page.keyboard.down('KeyK');
  await page.keyboard.press('KeyQ');
  await expect(page.locator('.enemy-lock')).toBeVisible();
  await expect(page.locator('#combat-notice')).toHaveText('Bloqueado · responde con la espada', { timeout: 45000 });
  expect(await page.evaluate(() => window.__veylun.sim.player.health)).toBe(10);
  expect(await page.evaluate(() => window.__veylun.sim.enemies[0]!.state)).toBe('recover');
  await page.keyboard.up('KeyK');
  await page.keyboard.press('KeyJ');
  await expect(page.locator('.enemy-health')).toHaveText('2 / 3', { timeout: 15000 });
  await expect(page.locator('#combat-notice')).toHaveText('Impacto · −1');
  await page.screenshot({ path: testInfo.outputPath('counterattack.png') });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Volver al checkpoint' }).click();
  await expect(page.locator('#enemy-status')).toBeHidden();
  await expect(page.locator('#combat-notice')).toBeHidden();
  expect(await page.evaluate(() => window.__veylun.sim.player.health)).toBe(10);
  expect(errors).toEqual([]);
});
