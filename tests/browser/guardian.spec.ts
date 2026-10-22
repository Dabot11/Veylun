import { expect, test } from '@playwright/test';
import './harness';
import { freshSave, SAVE_KEY } from '../../src/progression/save';

test.use({ baseURL: 'http://127.0.0.1:5174', viewport: { width: 640, height: 480 } });
test.setTimeout(420000);

test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus) {
    const state = await page.evaluate(() => ({ player: window.__veylun.sim.player, boss: window.__veylun.sim.enemies[3], mode: window.__veylun.sim.mode }));
    await info.attach('encounter-state', { body: JSON.stringify(state, null, 2), contentType: 'application/json' });
  }
});

test('completed sanctuary reload hides defeated enemies and a new adventure resets the light', async ({ page }) => {
  const save = freshSave();
  Object.assign(save, { checkpoint: 'before-guardian', reachedZone: 'guardian', hasKey: true, chestOpened: true,
    switchActivated: true, grateOpened: true, doorUnlocked: true, defeatedOrdinaryEnemies: ['sprout-1', 'sprout-2', 'spirit-1'],
    bossDefeated: true, altarActivated: true, completed: true });
  await page.addInitScript(({ key, save }) => localStorage.setItem(key, JSON.stringify(save)), { key: SAVE_KEY, save });
  await page.goto('/?test=1'); await expect(page.locator('body')).toHaveAttribute('data-engine', 'ready', { timeout: 60000 });
  await page.getByRole('button', { name: 'Continuar aventura' }).click();
  await expect(page.getByRole('heading', { name: 'Santuario restaurado' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__veylun.camera.camera.getScene().getTransformNodeByName('guardian')!.isEnabled())).toBe(false);
  expect(await page.evaluate(() => window.__veylun.sim.restorationProgress)).toBe(1);
  await page.getByRole('button', { name: 'Nueva aventura' }).click();
  await page.getByRole('button', { name: 'Borrar y comenzar' }).click();
  await expect(page.locator('#objective p')).toHaveText('Explora el bosque');
  // State/UI reset synchronously; SanctuaryView applies fog/light on the next render.
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__veylun.camera.camera.getScene();
    return { progress: window.__veylun.sim.restorationProgress, hp: window.__veylun.sim.enemies[3]!.hp,
      guardian: scene.getTransformNodeByName('guardian')!.isEnabled(), fog: scene.fogColor.asArray(),
      light: scene.meshes.some(m => m.name === 'restoration-light' && m.isEnabled()) };
  })).toEqual({ progress: 0, hp: 12, guardian: true, fog: [.62, .77, .66], light: false });
});

for (const device of ['keyboard', 'gamepad'] as const) {
  test(`${device}: block, counter, escape the slam, defeat the Guardian and restore the altar`, async ({ page }, testInfo) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    if (device === 'gamepad') await page.addInitScript(() => {
      const pad = { id: 'Xbox Guardian encounter QA', index: 0, connected: true, mapping: 'standard', timestamp: 0,
        axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
      Object.assign(window, { guardianPad: pad }); Object.defineProperty(navigator, 'getGamepads', { value: () => [pad] });
    });
    await page.goto('/?test=1');
    await expect(page.locator('body')).toHaveAttribute('data-engine', 'ready', { timeout: 60000 });
    await page.getByRole('button', { name: 'Nueva partida' }).click();
    // Use the normal graphics option for software-rendered, input-driven battles.
    await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
    await page.getByLabel('Sombras').uncheck(); await page.getByRole('button', { name: 'Volver', exact: true }).click();
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    // Prior level progress and entry position only: the boss keeps all 12 HP and its normal AI.
    await page.evaluate(() => {
      const g = window.__veylun.sim;
      Object.assign(g.save, { checkpoint: 'before-guardian', reachedZone: 'guardian', hasKey: true, chestOpened: true,
        switchActivated: true, grateOpened: true, doorUnlocked: true, defeatedOrdinaryEnemies: ['sprout-1', 'sprout-2', 'spirit-1'] });
      for (const e of g.enemies.slice(0, 3)) { e.hp = 0; e.state = 'dead'; e.timer = 3; }
      Object.assign(g.player, { x: 0, z: 111.9, y: .6, yaw: 0, vx: 0, vz: 0 });
      window.__veylun.camera.reset(g);
    });
    const controls = { shield: ['KeyK', 6], target: ['KeyQ', 7], attack: ['KeyJ', 2], interact: ['KeyE', 3] } as const;
    async function button(action: keyof typeof controls, down: boolean): Promise<void> {
      const [key, index] = controls[action];
      if (device === 'keyboard') { if (down) await page.keyboard.down(key); else await page.keyboard.up(key); }
      else await page.evaluate(({ index, down }) => {
        const pad = (window as unknown as { guardianPad: { buttons: { pressed: boolean; value: number }[] } }).guardianPad;
        Object.assign(pad.buttons[index]!, { pressed: down, value: down ? 1 : 0 });
      }, { index, down });
    }
    async function press(action: keyof typeof controls): Promise<void> {
      await button(action, true); await page.waitForTimeout(250); await button(action, false);
    }
    const held = new Set<string>();
    async function move(x: number, z: number): Promise<void> {
      if (device === 'gamepad') await page.evaluate(({ x, z }) => {
        const pad = (window as unknown as { guardianPad: { axes: number[] } }).guardianPad;
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
    async function go(x: number, z: number, range = .35): Promise<void> {
      const deadline = Date.now() + 45000;
      while (Date.now() < deadline) {
        const p = await page.evaluate(() => ({ x: window.__veylun.sim.player.x, z: window.__veylun.sim.player.z, yaw: window.__veylun.camera.yaw }));
        const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
        if (d < range) { await move(0, 0); return; }
        await move((dx * Math.cos(p.yaw) - dz * Math.sin(p.yaw)) / d, (dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw)) / d);
        await page.waitForTimeout(80);
      }
      await move(0, 0); throw new Error('Could not reach destination through movement controls');
    }
    async function combo(start: number): Promise<void> {
      // Drive only DOM keys / the simulated pad, on animation frames. CDP round
      // trips and the throttled HUD can outlast a combo window on software rendering.
      const observed = await page.evaluate(({ device, start }) => new Promise<number[]>((resolve, reject) => {
        const g = window.__veylun.sim, initial = g.age, deadline = performance.now() + 45000;
        const seen = new Set<number>(); let phase = 0, releasedAt = 0;
        const attack = (down: boolean): void => {
          if (device === 'keyboard') window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code: 'KeyJ', bubbles: true }));
          else {
            const pad = (window as unknown as { guardianPad: { buttons: { pressed: boolean; value: number }[] } }).guardianPad;
            Object.assign(pad.buttons[2]!, { pressed: down, value: down ? 1 : 0 });
          }
        };
        attack(true);
        function frame(): void {
          const p = g.player; if (p.combo) seen.add(p.combo);
          if (g.age - initial > 4 || performance.now() > deadline) {
            attack(false); reject(new Error(`Combo input timed out: phase=${phase}, combo=${p.combo}, hp=${g.enemies[3]!.hp}`)); return;
          }
          if (phase === 0 && p.combo === 1) { attack(false); releasedAt = g.age; phase = 1; }
          else if (phase === 1 && g.age > releasedAt) { attack(true); phase = 2; }
          else if (phase === 2 && (p.queued || p.combo === 2)) { attack(false); releasedAt = g.age; phase = 3; }
          else if (phase === 3 && g.age > releasedAt && p.combo === 2) { attack(true); phase = 4; }
          else if (phase === 4 && (p.queued || p.combo === 3)) { attack(false); phase = 5; }
          else if (phase === 5 && g.enemies[3]!.hp === start - 4) { resolve([...seen]); return; }
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      }), { device, start });
      expect(observed).toEqual([1, 2, 3]);
      await expect(page.locator('#boss-health')).toHaveText(`${start - 4} / 12`, { timeout: 20000 });
    }

    await button('shield', true); await press('target');
    await expect(page.locator('#boss small')).toHaveText('Golpe frontal · bloquea de frente', { timeout: 30000 });
    expect(await page.evaluate(() => window.__veylun.camera.camera.getScene().getTransformNodeByName('guardian-frontal')!.isEnabled())).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('frontal-warning.png') });
    await expect(page.locator('#combat-notice')).toHaveText('Golpe bloqueado · prepara tu contraataque', { timeout: 30000 });
    await expect(page.locator('#boss small')).toHaveText('Expuesto · acércate y ataca', { timeout: 30000 });
    await button('shield', false); await combo(12);

    await expect(page.locator('#boss small')).toHaveText('Golpe al suelo · sal del círculo', { timeout: 30000 });
    expect(await page.evaluate(() => window.__veylun.camera.camera.getScene().getTransformNodeByName('guardian-slam')!.isEnabled())).toBe(true);
    await go(0, 108.8); // Leave the entire marked radius using movement input.
    await expect(page.locator('#boss small')).toHaveText('Expuesto · acércate y ataca', { timeout: 30000 });
    expect(await page.evaluate(() => window.__veylun.sim.player.health)).toBe(10);
    await go(0, 111.9); await combo(8);

    await button('shield', true);
    await expect(page.locator('#combat-notice')).toHaveText('Golpe bloqueado · prepara tu contraataque', { timeout: 30000 });
    await expect(page.locator('#boss small')).toHaveText('Expuesto · acércate y ataca', { timeout: 30000 });
    await button('shield', false); await combo(4);
    expect(await page.evaluate(() => window.__veylun.sim.player.health)).toBe(10);
    await expect(page.locator('#boss')).toBeHidden();
    await expect(page.locator('#altar-guide')).toBeVisible({ timeout: 15000 });
    expect(await page.evaluate(() => window.__veylun.sim.mode)).toBe('playing');
    expect(await page.evaluate(() => window.__veylun.sim.save.completed)).toBe(false);
    expect(await page.evaluate(() => window.__veylun.camera.camera.getScene().getTransformNodeByName('altar-beacon')!.isEnabled())).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('altar-ready.png') });
    await go(0, 124.3); await expect(page.locator('#interaction')).toContainText('Restaurar el santuario');
    await press('interact'); await expect(page.locator('#restoration')).toBeVisible({ timeout: 15000 });
    expect(await page.evaluate(() => window.__veylun.camera.camera.getScene().getMeshByName('restoration-wave')!.isEnabled())).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('restoration.png') });
    await expect(page.getByRole('heading', { name: 'Santuario restaurado' })).toBeVisible({ timeout: 45000 });
    expect(await page.evaluate(() => window.__veylun.sim.save.completed)).toBe(true);
    if (device === 'keyboard') {
      await page.reload(); await expect(page.locator('body')).toHaveAttribute('data-engine', 'ready', { timeout: 60000 });
      await page.getByRole('button', { name: 'Continuar aventura' }).click();
      await expect(page.getByRole('heading', { name: 'Santuario restaurado' })).toBeVisible();
      expect(await page.evaluate(() => window.__veylun.sim.restorationProgress)).toBe(1);
    }
    expect(errors).toEqual([]);
  });
}
