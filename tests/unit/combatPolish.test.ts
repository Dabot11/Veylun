import { describe, expect, it } from 'vitest';
import { Simulation, type Commands } from '../../src/core/Simulation';
import { groundHeight } from '../../src/world/level';
import { combatFocus } from '../../src/ui/CombatHUD';

const idle: Commands = { x: 0, z: 0 };
function advance(sim: Simulation, seconds: number, input = idle): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) sim.step(1 / 60, input);
}
function place(sim: Simulation, x: number, z: number): void {
  Object.assign(sim.player, { x, z, y: groundHeight(x, z) });
}

describe('readable sprout encounter', () => {
  it('gives both sprouts turns without overlapping charge telegraphs', () => {
    const sim = new Simulation();
    place(sim, 0, 29);
    const turns = new Set<string>();
    for (let i = 0; i < 720; i++) {
      const attacking = sim.enemies.filter(e => e.kind === 'sprout' && ['windup', 'attack'].includes(e.state));
      expect(attacking.length).toBeLessThanOrEqual(1);
      if (attacking[0]) { sim.targetId = attacking[0].id; turns.add(attacking[0].id); }
      sim.step(1 / 60, { ...idle, shield: true });
    }
    expect(turns).toEqual(new Set(['sprout-1', 'sprout-2']));
    expect(sim.player.health).toBe(10);
  });

  it('stops a frontal charge on a shield and opens a counterattack window', () => {
    const sim = new Simulation(), enemy = sim.enemies[0]!;
    place(sim, -2, 26);
    sim.selectTarget();
    for (let i = 0; i < 120 && !sim.events.some(e => e.type === 'shield'); i++) sim.step(1 / 60, { ...idle, shield: true });
    expect(sim.events.some(e => e.type === 'shield')).toBe(true);
    expect(sim.player.health).toBe(10);
    expect(enemy.state).toBe('recover');
    const position = { x: enemy.x, z: enemy.z };
    advance(sim, .3, { ...idle, shield: true });
    expect({ x: enemy.x, z: enemy.z }).toEqual(position);
    sim.step(1 / 60, { ...idle, attack: true });
    advance(sim, .3);
    expect(enemy.hp).toBe(2);
  });

  it('pauses an enemy briefly on impact, then resumes its telegraph', () => {
    const sim = new Simulation(), enemy = sim.enemies[0]!;
    place(sim, -2, 26.5);
    enemy.state = 'windup'; enemy.timer = .2;
    sim.damageEnemy(enemy, 1);
    advance(sim, .1);
    expect(enemy.timer).toBe(.2);
    advance(sim, .4);
    expect(enemy.timer).toBeGreaterThan(.5);
    expect(enemy.stagger).toBe(0);
    advance(sim, .3);
    expect(enemy.state).toBe('attack');
  });

  it('reports actual damage without repeating a dead enemy hit or stopping the Guardian', () => {
    const sim = new Simulation(), enemy = sim.enemies[0]!, boss = sim.enemies[3]!;
    sim.damageEnemy(enemy, 2);
    sim.damageEnemy(enemy, 2);
    sim.damageEnemy(enemy, 2);
    expect(sim.events.filter(e => e.type === 'hit').map(e => e.damage)).toEqual([2, 1]);
    expect(sim.events.filter(e => e.type === 'enemy-death')).toHaveLength(1);
    sim.damageEnemy(boss, 2);
    expect(boss.stagger).toBe(0);
    expect(sim.save.defeatedOrdinaryEnemies).toEqual(['sprout-1']);
  });
});

describe('target selection and combat focus', () => {
  it('prefers the camera direction over a nearer enemy behind Ruen', () => {
    const sim = new Simulation(); place(sim, 0, 29);
    Object.assign(sim.enemies[0]!, { x: 0, z: 27 });
    Object.assign(sim.enemies[1]!, { x: 0, z: 34 });
    sim.step(1 / 60, { ...idle, target: true, viewYaw: 0 });
    expect(sim.targetId).toBe('sprout-2');
    sim.selectTarget();
    sim.step(1 / 60, { ...idle, target: true, viewYaw: Math.PI });
    expect(sim.targetId).toBe('sprout-1');
  });

  it('cycles left and right in camera order, including wraparound', () => {
    const sim = new Simulation(); place(sim, 0, 25);
    sim.enemies.slice(0, 3).forEach((e, i) => Object.assign(e, { x: (i - 1) * 2, z: 29 }));
    sim.selectTarget(0, 0);
    expect(sim.targetId).toBe('sprout-2');
    sim.selectTarget(1, 0); expect(sim.targetId).toBe('spirit-1');
    sim.selectTarget(1, 0); expect(sim.targetId).toBe('sprout-1');
    sim.selectTarget(-1, 0); expect(sim.targetId).toBe('spirit-1');
    sim.selectTarget();
    sim.selectTarget(-1, 0); expect(sim.targetId).toBe('sprout-2');
  });

  it('excludes a target behind a solid pillar and releases a persistent obstruction', () => {
    const sim = new Simulation(); place(sim, 2.2, 15);
    const enemy = sim.enemies[0]!;
    Object.assign(enemy, { x: 4.2, z: 15, y: groundHeight(4.2, 15), state: 'recover', timer: -10 });
    expect(sim.targets()).not.toContain(enemy);
    sim.targetId = enemy.id;
    advance(sim, .4); expect(sim.targetId).toBe(enemy.id);
    // A brief occlusion clears when the player gets around the pillar.
    place(sim, 4.2, 13);
    advance(sim, .3); expect(sim.targetId).toBe(enemy.id);
    place(sim, 2.2, 15);
    advance(sim, .7); expect(sim.targetId).toBeNull();
  });

  it('shows the locked enemy first, remembers hits briefly, and hides stale or distant feedback', () => {
    const sim = new Simulation(); place(sim, -2, 27);
    const first = sim.enemies[0]!, second = sim.enemies[1]!;
    expect(combatFocus(sim, null, 0)).toBe(first);
    sim.targetId = second.id;
    expect(combatFocus(sim, first.id, 3)).toBe(second);
    sim.targetId = null; first.hp = 0;
    expect(combatFocus(sim, first.id, 1)).toBe(first);
    sim.age = 2;
    expect(combatFocus(sim, first.id, 1)).toBeUndefined();
    place(sim, 0, 0);
    expect(combatFocus(sim, second.id, 10)).toBeUndefined();
    sim.mode = 'dead'; sim.targetId = second.id;
    expect(combatFocus(sim, null, 0)).toBeUndefined();
  });
});
