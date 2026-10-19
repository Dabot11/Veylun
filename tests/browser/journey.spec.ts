import { expect as baseExpect, test, type Page } from '@playwright/test';
import './harness';
import { freshSave, SAVE_KEY } from '../../src/progression/save';

// Software-rendered frames can keep a CDP assertion waiting longer than 5 s.
const expect = baseExpect.configure({ timeout: 30000 });

test.use({ baseURL: 'http://127.0.0.1:5174', viewport: { width: 640, height: 480 } });
test.setTimeout(900000);

async function ready(page: Page) {
  await page.goto('/?test=1');
  await expect(page.locator('body')).toHaveAttribute('data-engine', 'ready', { timeout: 60000 });
}
async function lowShadows(page: Page) {
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
  await page.getByLabel('Sombras').uncheck(); await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
}

// Observe the world and press real input actions on animation frames. Never
// advance the simulation, teleport Ruen, grant progress, or change enemy/hero HP.
async function play(page: Page, task: 'walk' | 'fight' | 'interact' | 'die', goal: number | { x: number; z: number } = 0) {
  return page.evaluate(({ task, goal }) => new Promise<void>((resolve, reject) => {
    const sim = window.__veylun.sim, start = sim.age, deaths = sim.save.deaths, wallDeadline = performance.now() + 240000;
    const held = new Set<string>(); let pulseUntil = -1, lastAttack = -1, lastTarget = -1;
    function setKeys(keys: Set<string>) {
      for (const key of held) if (!keys.has(key)) { window.dispatchEvent(new KeyboardEvent('keyup', { code: key, bubbles: true })); held.delete(key); }
      for (const key of keys) if (!held.has(key)) { window.dispatchEvent(new KeyboardEvent('keydown', { code: key, bubbles: true })); held.add(key); }
    }
    function done(error?: string) { setKeys(new Set()); if (error) reject(new Error(error)); else resolve(); }
    function frame() {
      const p = sim.player, enemy = sim.enemies[typeof goal === 'number' ? goal : 0]!;
      if (performance.now() > wallDeadline || sim.age - start > 120) {
        done(`Timed out: ${task}, player=${JSON.stringify({ x: p.x, z: p.z, hp: p.health, state: p.state })}, enemy=${JSON.stringify(enemy)}`); return;
      }
      if (task === 'die') {
        if (sim.save.deaths > deaths && sim.mode === 'playing') { done(); return; }
        requestAnimationFrame(frame); return;
      }
      if (sim.mode === 'dead' || sim.save.deaths > deaths) { done(`Unexpected death during ${task}`); return; }
      if (task === 'interact') {
        if (sim.age > start + .6) { done(); return; }
        setKeys(new Set(sim.age < start + .25 ? ['KeyE'] : [])); requestAnimationFrame(frame); return;
      }
      let destination: { x: number; z: number }, moving = 1;
      const keys = new Set<string>();
      if (task === 'walk') {
        const end = goal as { x: number; z: number };
        if (Math.hypot(p.x - end.x, p.z - end.z) < .65) { done(); return; }
        // Follow the same waypoint that positions the visible guiding light.
        destination = sim.guidancePosition();
        // A chosen intermediate stop (e.g. arena entrance) lies on this route.
        if (Math.hypot(end.x - p.x, end.z - p.z) < Math.hypot(destination.x - p.x, destination.z - p.z)) destination = end;
      } else {
        if (enemy.hp <= 0) { done(); return; }
        destination = enemy;
        const d = Math.hypot(enemy.x - p.x, enemy.z - p.z);
        const slam = enemy.kind === 'guardian' && enemy.attackIndex % 2 === 1 && (enemy.state === 'windup' || enemy.state === 'attack');
        moving = slam ? -1 : d > (enemy.kind === 'guardian' ? 2.1 : 1.3) ? 1 : 0;
        if (!sim.targetId && d < 13 && sim.age - lastTarget > .5) { keys.add('KeyQ'); lastTarget = sim.age; }
        if ((enemy.state === 'windup' || enemy.state === 'attack') && !slam) keys.add('KeyK');
        if (!slam && !keys.has('KeyK') && d < 2.6 && sim.age - lastAttack > .24) {
          pulseUntil = sim.age + .05; lastAttack = sim.age;
        }
        if (sim.age < pulseUntil) keys.add('KeyJ');
      }
      if (moving) {
        const dx = destination.x - p.x, dz = destination.z - p.z, yaw = window.__veylun.camera.yaw;
        const length = Math.hypot(dx, dz), x = moving * (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / length;
        const z = moving * (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / length;
        if (x < -.38) keys.add('KeyA'); if (x > .38) keys.add('KeyD');
        if (z < -.38) keys.add('KeyS'); if (z > .38) keys.add('KeyW');
      }
      setKeys(keys); requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }), { task, goal });
}

test('new adventure to restoration with normal inputs, death, checkpoints and reloads', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await ready(page); await page.getByRole('button', { name: 'Nueva partida', exact: true }).click();
  await expect(page.locator('#objective-help')).toContainText('WASD'); await lowShadows(page);
  await play(page, 'walk', { x: 0, z: 20 });
  await play(page, 'fight', 0); await play(page, 'fight', 1);
  await expect.poll(() => page.evaluate(() => window.__veylun.sim.save.checkpoint)).toBe('after-sprouts');
  console.log('Journey: Brotes cleared, checkpoint 1 earned');
  await page.reload(); await expect(page.locator('body')).toHaveAttribute('data-engine', 'ready', { timeout: 60000 });
  await page.getByRole('button', { name: 'Continuar aventura' }).click();
  await expect(page.locator('#location')).toContainText('Sendero de las raíces'); await lowShadows(page);
  await play(page, 'walk', { x: 0, z: 48 }); await play(page, 'fight', 2);
  await play(page, 'walk', { x: -4, z: 60 }); await play(page, 'interact');
  await expect.poll(() => page.evaluate(() => window.__veylun.sim.save.grateOpened)).toBe(true);
  console.log('Journey: Spirit cleared, switch and grate opened');
  await play(page, 'walk', { x: 10, z: 61 }); await play(page, 'interact');
  await expect(page.locator('#objective small')).toContainText('Llave');
  await page.screenshot({ path: info.outputPath('chest-exit.png') });
  await play(page, 'walk', { x: 0, z: 87.5 }); await play(page, 'interact');
  await expect.poll(() => page.evaluate(() => window.__veylun.sim.save.checkpoint)).toBe('before-guardian');
  console.log('Journey: key acquired, enclosure exited, checkpoint 2 earned');
  // Wait inside the arena for the boss to approach. Walking to its starting
  // position would try to pass through its solid body while it attacks.
  await play(page, 'walk', { x: 0, z: 103 }); await play(page, 'die');
  const retry = await page.evaluate(() => ({ p: window.__veylun.sim.player.z, hp: window.__veylun.sim.player.health,
    boss: window.__veylun.sim.enemies[3]!.hp, deaths: window.__veylun.sim.save.deaths, key: window.__veylun.sim.save.hasKey }));
  expect(retry).toEqual({ p: 85, hp: 10, boss: 12, deaths: 1, key: true });
  await page.reload(); await expect(page.locator('body')).toHaveAttribute('data-engine', 'ready', { timeout: 60000 });
  await page.getByRole('button', { name: 'Continuar aventura' }).click();
  await expect(page.locator('#location')).toContainText('Puerta del santuario'); await lowShadows(page);
  console.log('Journey: death and reload preserve progress, Guardian resets');
  await play(page, 'walk', { x: 0, z: 103 }); await play(page, 'fight', 3);
  await expect(page.locator('#altar-guide')).toBeVisible();
  expect(await page.evaluate(() => window.__veylun.sim.save.completed)).toBe(false);
  console.log('Journey: Guardian defeated, explicit altar activation still required');
  await play(page, 'walk', { x: 0, z: 124.7 }); await play(page, 'interact');
  await expect(page.getByRole('heading', { name: 'Santuario restaurado' })).toBeVisible({ timeout: 45000 });
  await page.screenshot({ path: info.outputPath('journey-victory.png') });
  const save = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
  expect(save.completed).toBe(true); expect(save.deaths).toBe(1); expect(save.playedSeconds).toBeGreaterThan(40);
  console.log(`Journey: victory, ${save.playedSeconds.toFixed(1)} simulated seconds, ${save.deaths} deliberate death`);
  expect(errors).toEqual([]);
});

test('unavailable storage keeps session Continue and restart confirmation; new game clears old notices', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Disabled', 'SecurityError'); } }));
  await ready(page); await expect(page.locator('#save-warning')).toContainText('recargar');
  await page.getByRole('button', { name: 'Nueva partida', exact: true }).click(); await lowShadows(page);
  // Isolated persistence fixture, separate from the uninterrupted input-driven adventure.
  await page.evaluate(() => {
    const g = window.__veylun.sim;
    for (const e of g.enemies.slice(0, 2)) g.damageEnemy(e, 3);
  });
  await expect.poll(() => page.evaluate(() => window.__veylun.sim.save.checkpoint)).toBe('after-sprouts');
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Volver al menú' }).click();
  await page.getByRole('button', { name: 'Continuar aventura' }).click();
  await expect(page.locator('#location')).toContainText('Sendero de las raíces');
  expect(await page.evaluate(() => window.__veylun.sim.enemies.slice(0, 2).every(e => e.hp === 0))).toBe(true);
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Reiniciar partida' }).click();
  await expect(page.getByRole('button', { name: 'Conservar partida' })).toBeVisible();
  await page.getByRole('button', { name: 'Borrar y comenzar' }).click();
  await expect(page.locator('#objective p')).toHaveText('Explora el bosque');
  await expect(page.locator('#toast')).toBeHidden();
  expect(await page.evaluate(() => window.__veylun.sim.save.checkpoint)).toBe('start');
  await expect(page.locator('#save-warning')).toContainText('recargar');
});

test('controls before starting do not create a save; restoration can pause and resume safely', async ({ page }) => {
  await ready(page); await page.getByRole('button', { name: 'Controles' }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBeNull();
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  const save = freshSave();
  Object.assign(save, { checkpoint: 'before-guardian', reachedZone: 'guardian', hasKey: true, chestOpened: true,
    switchActivated: true, grateOpened: true, doorUnlocked: true, defeatedOrdinaryEnemies: ['sprout-1', 'sprout-2', 'spirit-1'], bossDefeated: true });
  await page.evaluate(({ key, save }) => localStorage.setItem(key, JSON.stringify(save)), { key: SAVE_KEY, save });
  await page.reload(); await expect(page.locator('body')).toHaveAttribute('data-engine', 'ready', { timeout: 60000 });
  await page.getByRole('button', { name: 'Continuar aventura' }).click(); await lowShadows(page);
  await page.evaluate(() => { const p = window.__veylun.sim.player; Object.assign(p, { x: 0, z: 125, y: .6 }); });
  await play(page, 'interact'); await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Pausa' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Volver al checkpoint' })).toHaveCount(0);
  const progress = await page.evaluate(() => window.__veylun.sim.modeTime);
  await page.waitForTimeout(500); expect(await page.evaluate(() => window.__veylun.sim.modeTime)).toBe(progress);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Santuario restaurado' })).toBeVisible({ timeout: 45000 });
});
