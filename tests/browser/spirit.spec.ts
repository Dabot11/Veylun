import { expect, test } from '@playwright/test';
import './harness';

test.use({ baseURL: 'http://127.0.0.1:5174', viewport: { width: 800, height: 600 } });
test.setTimeout(180000);

for (const device of ['keyboard', 'gamepad'] as const) {
  test(`${device}: read the spell, block, approach, defeat the Spirit and activate its switch`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    if (device === 'gamepad') await page.addInitScript(() => {
      const pad = { id: 'Xbox Spirit encounter QA', index: 0, connected: true, mapping: 'standard', timestamp: 0,
        axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
      Object.assign(window, { spiritPad: pad });
      Object.defineProperty(navigator, 'getGamepads', { value: () => [pad] });
    });
    await page.goto('/?test=1');
    await expect(page.locator('body')).toHaveAttribute('data-engine', 'ready', { timeout: 60000 });
    await page.getByRole('button', { name: 'Nueva partida' }).click();
    // SwiftShader is much slower than a GPU. Use the game's normal shadow setting
    // for this longer input-driven encounter; other browser scenarios cover shadows on.
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
    await page.getByLabel('Sombras').uncheck();
    await page.getByRole('button', { name: 'Volver', exact: true }).click();
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    // Prior Brotes progress is a fixture. The Spirit retains normal AI and all HP;
    // every defence, movement, sword hit and interaction below uses browser input.
    await page.evaluate(() => {
      const g = window.__veylun.sim;
      g.save.defeatedOrdinaryEnemies = ['sprout-1', 'sprout-2']; g.save.checkpoint = 'after-sprouts';
      for (const e of g.enemies.slice(0, 2)) { e.hp = 0; e.state = 'dead'; }
      Object.assign(g.player, { x: -2, z: 50, y: 0, yaw: 0, vx: 0, vz: 0 });
      window.__veylun.camera.reset(g);
    });
    const controls = { shield: ['KeyK', 6], target: ['KeyQ', 7], attack: ['KeyJ', 2], interact: ['KeyE', 3] } as const;
    async function button(action: keyof typeof controls, down: boolean): Promise<void> {
      const [key, index] = controls[action];
      if (device === 'keyboard') { if (down) await page.keyboard.down(key); else await page.keyboard.up(key); }
      else await page.evaluate(({ index, down }) => {
        const pad = (window as unknown as { spiritPad: { buttons: { pressed: boolean; value: number }[] } }).spiritPad;
        Object.assign(pad.buttons[index]!, { pressed: down, value: down ? 1 : 0 });
      }, { index, down });
    }
    async function press(action: keyof typeof controls): Promise<void> {
      await button(action, true); await page.waitForTimeout(220); await button(action, false);
    }
    const held = new Set<string>();
    async function move(x: number, z: number): Promise<void> {
      if (device === 'gamepad') await page.evaluate(({ x, z }) => {
        const pad = (window as unknown as { spiritPad: { axes: number[] } }).spiritPad;
        pad.axes[0] = x; pad.axes[1] = -z;
      }, { x, z });
      else {
        const keys = new Set<string>();
        if (x < -.25) keys.add('KeyA'); if (x > .25) keys.add('KeyD');
        if (z < -.25) keys.add('KeyS'); if (z > .25) keys.add('KeyW');
        for (const key of held) if (!keys.has(key)) { await page.keyboard.up(key); held.delete(key); }
        for (const key of keys) if (!held.has(key)) { await page.keyboard.down(key); held.add(key); }
      }
    }
    async function approach(x: number, z: number, range: number): Promise<void> {
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline) {
        const position = await page.evaluate(() => ({ x: window.__veylun.sim.player.x, z: window.__veylun.sim.player.z, yaw: window.__veylun.camera.yaw }));
        const dx = x - position.x, dz = z - position.z, d = Math.hypot(dx, dz);
        if (d < range) { await move(0, 0); return; }
        await move((dx * Math.cos(position.yaw) - dz * Math.sin(position.yaw)) / d, (dx * Math.sin(position.yaw) + dz * Math.cos(position.yaw)) / d);
        await page.waitForTimeout(80);
      }
      await move(0, 0);
      throw new Error('Could not reach the encounter destination through movement controls');
    }

    await button('shield', true); await press('target');
    await expect(page.locator('.enemy-heading b')).toHaveText('Espíritu errante');
    await expect(page.locator('.enemy-state')).toHaveText('Preparando magia · bloquea o esquiva', { timeout: 15000 });
    expect(await page.evaluate(() => window.__veylun.camera.camera.getScene().getTransformNodeByName('spirit-charge')!.isEnabled())).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('spirit-charge.png') });
    await expect(page.locator('#combat-notice')).toHaveText('Magia bloqueada · acércate y ataca', { timeout: 30000 });
    expect(await page.evaluate(() => window.__veylun.sim.player.health)).toBe(10);
    await expect(page.locator('.enemy-state')).toHaveText('Agotado · acércate y ataca');
    await button('shield', false);
    const spirit = await page.evaluate(() => ({ x: window.__veylun.sim.enemies[2]!.x, z: window.__veylun.sim.enemies[2]!.z }));
    await approach(spirit.x, spirit.z, 1.55);
    await press('attack');
    await expect(page.locator('.enemy-health')).toHaveText('1 / 2');
    await press('attack');
    await expect.poll(() => page.evaluate(() => window.__veylun.sim.enemies[2]!.hp)).toBe(0);
    expect(await page.evaluate(() => window.__veylun.sim.player.health)).toBe(10);
    expect(await page.evaluate(() => window.__veylun.sim.projectiles.length)).toBe(0);
    await expect(page.locator('#objective p')).toHaveText('Activa el interruptor de las ruinas');
    await expect(page.locator('#ruins-guide')).toBeVisible({ timeout: 30000 });
    expect(await page.evaluate(() => window.__veylun.camera.camera.getScene().getTransformNodeByName('ruins-switch-beacon')!.isEnabled())).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('switch-revealed.png') });
    await approach(-4, 60, 1.65);
    await expect(page.locator('#interaction')).toContainText('Activar interruptor');
    await press('interact');
    await expect.poll(() => page.evaluate(() => window.__veylun.sim.save.grateOpened)).toBe(true);
    await expect(page.locator('#ruins-guide')).toBeHidden();
    expect(await page.evaluate(() => window.__veylun.camera.camera.getScene().getTransformNodeByName('ruins-switch-beacon')!.isEnabled())).toBe(false);
    expect(errors).toEqual([]);
  });
}
