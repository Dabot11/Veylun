import { describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Simulation, type Commands } from '../../src/core/Simulation';
import { attacks } from '../../src/player/combat';
import { groundHeight } from '../../src/world/level';
import { createRuen } from '../../src/assets/characters';
import { Geometry } from '../../src/assets/geometry';

// Textures need a browser canvas; these tests exercise the actual rig transforms.
vi.mock('../../src/assets/surfaceTexture', () => ({ surfaceTexture: () => null }));

const idle: Commands = { x: 0, z: 0 };
function advance(game: Simulation, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) game.step(1 / 60, idle);
}
function encounter(playerX: number, enemyX: number, z = 28): Simulation {
  const game = new Simulation();
  Object.assign(game.player, { x: playerX, z, y: groundHeight(playerX, z) });
  Object.assign(game.enemies[0]!, {
    x: enemyX, z, y: groundHeight(enemyX, z), state: 'recover', timer: 0,
  });
  return game;
}

describe('attack regressions', () => {
  it('turns toward movement before hitting when direction and attack arrive together', () => {
    const game = encounter(-3.5, -2);
    game.step(1 / 60, { x: 1, z: 0, attack: true });
    advance(game, .3);
    expect(game.enemies[0]!.hp).toBe(2);
  });

  it('keeps a fast second press instead of discarding it during the windup', () => {
    const game = new Simulation();
    game.step(1 / 60, { ...idle, attack: true });
    advance(game, .03);
    game.step(1 / 60, { ...idle, attack: true });
    advance(game, .45);
    expect(game.player.combo).toBe(2);
  });

  it('buffers a fresh attack just before a roll finishes', () => {
    const game = new Simulation();
    game.step(1 / 60, { ...idle, dodge: true });
    advance(game, .35);
    game.step(1 / 60, { ...idle, attack: true });
    advance(game, .12);
    expect(game.player.state).toBe('attack1');
  });

  it('expires an early blocked press instead of attacking unexpectedly after a roll', () => {
    const game = new Simulation();
    game.step(1 / 60, { ...idle, dodge: true });
    game.step(1 / 60, { ...idle, attack: true });
    advance(game, .7);
    expect(game.events.some(event => event.type === 'sword')).toBe(false);
  });

  it('cancels a queued combo when the player is hit', () => {
    const game = new Simulation();
    game.step(1 / 60, { ...idle, attack: true });
    game.step(1 / 60, { ...idle, attack: true });
    expect(game.player.queued).toBe(true);
    game.receiveDamage(1, { x: 0, z: 1 });
    advance(game, 1);
    expect(game.player.queued).toBe(false);
    expect(game.events.filter(event => event.type === 'sword')).toHaveLength(1);
  });

  it('does not cancel a roll with a simultaneous jump', () => {
    const game = new Simulation();
    game.step(1 / 60, { ...idle, dodge: true, jump: true });
    expect(game.player.state).toBe('roll');
    expect(game.player.grounded).toBe(true);
  });

  it('cannot damage an enemy through a solid arch pillar', () => {
    const game = encounter(2.2, 4.2, 15);
    game.player.yaw = Math.PI / 2;
    game.step(1 / 60, { ...idle, attack: true });
    advance(game, .3);
    expect(game.enemies[0]!.hp).toBe(3);
  });

  it('a single press still produces only one strike', () => {
    const game = new Simulation();
    game.step(1 / 60, { ...idle, attack: true });
    advance(game, 2);
    expect(game.events.filter(event => event.type === 'sword')).toHaveLength(1);
  });

  it.each([1, 2, 3])('keeps the blade in front during attack %i damage frames', combo => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    try {
      const rig = createRuen(new Geometry(scene));
      const player = new Simulation().player;
      player.combo = combo;
      const attack = attacks[combo - 1]!;
      for (const fraction of [.1, .5, .9]) {
        player.attackTime = attack.windup + (attack.activeEnd - attack.windup) * fraction;
        rig.update(player, 0);
        const tip = Vector3.TransformCoordinates(
          new Vector3(0, -.78, 0), rig.parts['sword']!.computeWorldMatrix(true),
        );
        expect(tip.z, `blade position during hit: ${tip.toString()}`).toBeGreaterThan(.65);
      }
    } finally {
      scene.dispose();
      engine.dispose();
    }
  });
});
