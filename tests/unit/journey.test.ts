import { describe, expect, it } from 'vitest';
import { Simulation } from '../../src/core/Simulation';
import { angleTo, distance } from '../../src/core/math';
import { freshSave, parseSave, SaveStore, SAVE_KEY } from '../../src/progression/save';
import { checkpoints, groundHeight, interactables } from '../../src/world/level';

function ruins() {
  const save = freshSave();
  Object.assign(save, { checkpoint: 'after-sprouts', reachedZone: 'ruins',
    defeatedOrdinaryEnemies: ['sprout-1', 'sprout-2', 'spirit-1'], switchActivated: true, grateOpened: true });
  return save;
}
function cleared() {
  return { ...ruins(), checkpoint: 'before-guardian' as const, hasKey: true, chestOpened: true, doorUnlocked: true, bossDefeated: true };
}
function place(g: Simulation, x: number, z: number) {
  Object.assign(g.player, { x, z, y: groundHeight(x, z), vx: 0, vz: 0, vy: 0 });
}

describe('adventure continuity', () => {
  it.each([['after-sprouts', 'roots'], ['before-guardian', 'gate']] as const)('loads %s in its actual zone', (checkpoint, zone) => {
    const g = new Simulation({ ...cleared(), checkpoint });
    expect(g.zone).toBe(zone);
    expect(g.player).toMatchObject(checkpoints[checkpoint]);
  });

  it('updates the zone immediately on death or manual checkpoint return', () => {
    const g = new Simulation(ruins()); place(g, 0, 75); g.step(1 / 60, { x: 0, z: 0 });
    expect(g.zone).toBe('ruins');
    g.respawn(); expect(g.zone).toBe('roots');
    expect(g.save.reachedZone).toBe('ruins');
    expect(g.save.grateOpened).toBe(true);
  });

  it('cannot undo a restoration or a victory by returning to a checkpoint', () => {
    const g = new Simulation(cleared()); place(g, 0, 125);
    expect(g.interact()).toBe(true);
    g.respawn(); expect(g.mode).toBe('restoring');
    for (let i = 0; i < 190; i++) g.step(1 / 60, { x: 0, z: 0 });
    expect(g.mode).toBe('won'); g.respawn(); expect(g.mode).toBe('won');
    expect(parseSave(JSON.stringify(g.save))?.completed).toBe(true);
  });

  it('retains a defeated sprout through death while resetting the surviving opponent', () => {
    const g = new Simulation(); g.damageEnemy(g.enemies[0]!, 3); g.damageEnemy(g.enemies[1]!, 1);
    g.receiveDamage(10, { x: 0, z: -1 });
    for (let i = 0; i < 110; i++) g.step(1 / 60, { x: 0, z: 0 });
    const resumed = new Simulation(parseSave(JSON.stringify(g.save))!);
    for (const game of [g, resumed]) {
      expect(game.player.health).toBe(10); expect(game.player.z).toBe(0);
      expect(game.enemies[0]!.hp).toBe(0); expect(game.enemies[1]!.hp).toBe(3);
      expect(game.save.deaths).toBe(1); expect(game.save.checkpoint).toBe('start');
    }
  });
});

describe('session progress when browser storage fails', () => {
  it('continues the latest session even when a previous disk save is readable but writing fails', () => {
    const store = new SaveStore({ getItem: () => JSON.stringify(freshSave()), setItem: () => { throw Error('quota'); }, removeItem: () => {} });
    expect(store.read()?.checkpoint).toBe('start');
    store.write(ruins());
    expect(store.read()?.grateOpened).toBe(true);
    expect(store.warning).toContain('recargar');
    const copy = store.read()!; copy.hasKey = true;
    expect(store.read()?.hasKey).toBe(false);
  });

  it('retains session data after storage becomes unreadable and can retry saving later', () => {
    let blocked = true; const values = new Map<string, string>();
    const store = new SaveStore({ getItem: k => { if (blocked) throw Error(); return values.get(k) ?? null; },
      setItem: (k, v) => { if (blocked) throw Error(); values.set(k, v); }, removeItem: k => { values.delete(k); } });
    expect(store.read()).toBeNull(); store.write(cleared());
    expect(store.read()?.bossDefeated).toBe(true); expect(store.warning).not.toBe('');
    blocked = false; store.write(store.read()!);
    expect(store.warning).toBe(''); expect(parseSave(values.get(SAVE_KEY)!)?.bossDefeated).toBe(true);
  });

  it('clears the session even if deleting its persisted version fails', () => {
    const store = new SaveStore({ getItem: () => JSON.stringify(cleared()), setItem: () => {}, removeItem: () => { throw Error(); } });
    expect(store.read()?.bossDefeated).toBe(true); store.clear();
    expect(store.read()).toBeNull(); expect(store.warning).not.toBe('');
  });
});

describe('guidance through the ruins', () => {
  it.each([[-4, 60], [0, 70], [14, 61]])('guides a walking player from (%s, %s) through the open grate to the chest and back out', (x, z) => {
    const g = new Simulation(ruins()); place(g, x, z);
    function follow(goal: { x: number; z: number }) {
      for (let i = 0; i < 5000 && distance(g.player, goal) > 1; i++) {
        const a = angleTo(g.player, g.guidancePosition());
        g.step(1 / 60, { x: Math.sin(a), z: Math.cos(a) }); g.events = [];
      }
      expect(distance(g.player, goal)).toBeLessThan(1);
    }
    follow(interactables['key-chest']); expect(g.interact()).toBe(true);
    expect(g.save.hasKey).toBe(true);
    follow(interactables['sanctuary-door']); expect(g.interact()).toBe(true);
    expect(g.save.checkpoint).toBe('before-guardian');
  });
});
