import { describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Simulation, type Commands, type Projectile } from '../../src/core/Simulation';
import { freshSave } from '../../src/progression/save';
import { groundHeight, interactables } from '../../src/world/level';
import { angleTo, distance } from '../../src/core/math';
import { incomingMagic, spiritCombat } from '../../src/enemies/spiritCombat';
import { SpiritView } from '../../src/world/SpiritView';
import { Geometry } from '../../src/assets/geometry';

const idle: Commands = { x: 0, z: 0 };
function encounter(): Simulation {
  const save = freshSave();
  save.defeatedOrdinaryEnemies = ['sprout-1', 'sprout-2']; save.checkpoint = 'after-sprouts';
  const game = new Simulation(save);
  place(game, -2, 50);
  return game;
}
function place(game: Simulation, x: number, z: number): void {
  Object.assign(game.player, { x, z, y: groundHeight(x, z), vx: 0, vz: 0 });
}
function advance(game: Simulation, seconds: number, input = idle): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) game.step(1 / 60, input);
}
function shot(x: number, z: number, vx: number, vz: number, y = 1): Projectile {
  return { id: 1, ownerId: 'spirit-1', x, y, z, vx, vz, life: 4 };
}

describe('Spirit attack rhythm', () => {
  it('announces the charge, locks aim before release and never homes during flight', () => {
    const game = encounter(), spirit = game.enemies[2]!;
    advance(game, 1.5);
    expect(spirit.state).toBe('windup');
    expect(game.events.filter(e => e.type === 'spirit-charge')).toHaveLength(1);
    expect(game.projectiles).toHaveLength(0);
    advance(game, .42);
    expect(spirit.timer).toBeGreaterThan(spiritCombat.aimLockTime);
    const aim = { ...spirit.aim };
    advance(game, .5, { x: 1, z: 0 });
    expect(spirit.aim).toEqual(aim);
    expect(game.projectiles).toHaveLength(1);
    const spell = game.projectiles[0]!;
    expect(spell.vx).toBeCloseTo(0);
    expect(spell.vz).toBeCloseTo(-spiritCombat.projectileSpeed);
    advance(game, .4, { x: 1, z: 0 });
    expect(spell.vx).toBeCloseTo(0);
    expect(game.events.filter(e => e.type === 'projectile')).toHaveLength(1);
    advance(game, 1);
    expect(game.player.health).toBe(10);
  });

  it('keeps facing Ruen while retreating before the charge', () => {
    const game = encounter(), spirit = game.enemies[2]!;
    place(game, -2, 53);
    advance(game, .3);
    expect(spirit.z).toBeGreaterThan(56);
    expect(spirit.yaw).toBeCloseTo(angleTo(spirit, game.player));
  });

  it('does not charge through cover, then gives a full warning when sight returns', () => {
    const game = encounter(), spirit = game.enemies[2]!;
    place(game, 2.2, 15);
    Object.assign(spirit, { x: 4.2, z: 15, y: groundHeight(4.2, 15) + .7, home: { x: 4.2, z: 15 } });
    advance(game, 4);
    expect(game.events.some(e => e.type === 'spirit-charge')).toBe(false);
    expect(game.projectiles).toHaveLength(0);
    place(game, 5.5, 13);
    advance(game, 1);
    expect(spirit.state).toBe('chase');
    advance(game, .5);
    expect(spirit.state).toBe('windup');
    expect(game.projectiles).toHaveLength(0);
  });

  it('lets a player block from six metres, approach and land a counterattack before recovery ends', () => {
    const game = encounter(), spirit = game.enemies[2]!;
    game.targetId = spirit.id;
    for (let i = 0; i < 360 && !game.events.some(e => e.type === 'magic-block'); i++) game.step(1 / 60, { ...idle, shield: true });
    expect(game.events.some(e => e.type === 'magic-block')).toBe(true);
    expect(game.player.health).toBe(10);
    expect(spirit.state).toBe('recover');
    const position = { x: spirit.x, z: spirit.z };
    for (let i = 0; i < 180 && distance(game.player, spirit) > 1.5; i++) {
      const yaw = angleTo(game.player, spirit);
      game.step(1 / 60, { x: Math.sin(yaw), z: Math.cos(yaw) });
    }
    game.step(1 / 60, { ...idle, attack: true }); advance(game, .25);
    expect(spirit.hp).toBe(1);
    expect(spirit.state).toBe('recover');
    expect({ x: spirit.x, z: spirit.z }).toEqual(position);
    expect(game.player.health).toBe(10);
  });
});

describe('swept magic collision and defence', () => {
  it('a fast shot hits a thin wall before the player behind it', () => {
    const game = encounter(); place(game, 8, 61);
    game.projectiles = [shot(5, 61, 240, 0)];
    game.step(1 / 60, idle);
    expect(game.player.health).toBe(10);
    expect(game.projectiles).toHaveLength(0);
    const impact = game.events.find(e => e.type === 'magic-impact')!;
    expect(impact.x).toBeLessThan(6.8);
  });

  it('hits the player when they are before the wall, even when both are crossed in one tick', () => {
    const game = encounter(); place(game, 5, 61);
    game.projectiles = [shot(3, 61, 360, 0)];
    game.step(1 / 60, idle);
    expect(game.player.health).toBe(9);
    expect(game.projectiles).toHaveLength(0);
    expect(game.events.some(e => e.type === 'magic-impact')).toBe(false);
  });

  it('allows a shot above a wall rather than using an infinite-height collider', () => {
    const game = encounter(); place(game, 0, 51);
    game.projectiles = [shot(5, 61, 240, 0, 5)];
    game.step(1 / 60, idle);
    expect(game.projectiles[0]!.x).toBeCloseTo(9);
  });

  it.each([['front', 52, -120, 10], ['rear', 48, 120, 9]] as const)('%s hits respect shield direction', (_, z, vz, health) => {
    const game = encounter(); game.player.yaw = 0;
    game.projectiles = [shot(-2, z, 0, vz)];
    game.step(1 / 60, { ...idle, shield: true });
    expect(game.player.health).toBe(health);
    expect(game.events.some(e => e.type === 'magic-block')).toBe(health === 10);
    expect(game.projectiles).toHaveLength(0);
  });

  it('evades contact during a roll, but late contact after invulnerability can hurt', () => {
    const game = encounter();
    game.projectiles = [shot(-2, 50.6, 0, -60)];
    game.step(1 / 60, { x: 1, z: 0, dodge: true });
    expect(game.player.health).toBe(10);
    expect(game.events.some(e => e.type === 'magic-dodge')).toBe(true);
    advance(game, .3);
    game.projectiles = [shot(game.player.x, game.player.z + .6, 0, -60)];
    game.step(1 / 60, idle);
    expect(game.player.health).toBe(9);
  });

  it('does not hit Ruen when a projectile passes below an airborne body', () => {
    const game = encounter(); game.player.y = 2; game.player.grounded = false;
    game.projectiles = [shot(-2, 50.6, 0, -60)];
    game.step(1 / 60, idle);
    expect(game.player.health).toBe(10);
    expect(game.projectiles).toHaveLength(1);
  });

  it('drops threat advice for a shot that misses to the side or has passed', () => {
    const spell = shot(-2, 52, 0, -4.2), player = { x: -2, z: 50, y: 0 };
    expect(incomingMagic(spell, player)).toBe(true);
    expect(incomingMagic(spell, { ...player, x: 0 })).toBe(false);
    expect(incomingMagic({ ...spell, z: 49 }, player)).toBe(false);
  });
});

describe('Spirit victory and reusable visuals', () => {
  it('clears its magic on defeat and points to the switch without opening the grate automatically', () => {
    const game = encounter(); game.projectiles = [shot(-2, 52, 0, -4.2)];
    expect(game.ruinsSwitchReady).toBe(false);
    game.damageEnemy(game.enemies[2]!, 2);
    expect(game.projectiles).toHaveLength(0);
    expect(game.ruinsSwitchReady).toBe(true);
    expect(game.save.grateOpened).toBe(false);
    expect(game.objectivePosition()).toEqual(interactables['ruins-switch']);
    expect(game.events.filter(e => e.type === 'spirit-cleared')).toHaveLength(1);
    game.damageEnemy(game.enemies[2]!, 1);
    expect(game.events.filter(e => e.type === 'spirit-cleared')).toHaveLength(1);
  });

  it('restores the ready switch on reload and clears its cue after interaction', () => {
    const game = encounter(); game.damageEnemy(game.enemies[2]!, 2);
    const resumed = new Simulation(game.save);
    expect(resumed.ruinsSwitchReady).toBe(true);
    place(resumed, -4, 60);
    expect(resumed.interact()).toBe(true);
    expect(resumed.ruinsSwitchReady).toBe(false);
    expect(resumed.save.grateOpened).toBe(true);
    expect(new Simulation(resumed.save).ruinsSwitchReady).toBe(false);
  });

  it('reuses spell meshes across casts and removes charge/projectile visuals on death', () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      const view = new SpiritView(new Geometry(scene)), game = encounter(), spirit = game.enemies[2]!;
      const count = scene.meshes.length;
      spirit.state = 'windup'; spirit.timer = .6;
      view.update(game);
      expect(scene.getTransformNodeByName('spirit-charge')!.isEnabled()).toBe(true);
      for (let i = 0; i < 100; i++) {
        game.projectiles = [shot(-2, 53, 0, -4.2)]; view.update(game);
        game.projectiles = []; view.update(game);
      }
      expect(scene.meshes).toHaveLength(count);
      game.damageEnemy(spirit, 2); view.update(game);
      expect(scene.getTransformNodeByName('spirit-charge')!.isEnabled()).toBe(false);
      expect(scene.meshes.filter(m => m.name === 'spell-core').every(m => !m.isEnabled())).toBe(true);
    } finally { scene.dispose(); engine.dispose(); }
  });
});
