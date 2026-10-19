import { describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Viewport } from '@babylonjs/core/Maths/math.viewport';
import { Simulation, type Commands } from '../../src/core/Simulation';
import { freshSave, parseSave } from '../../src/progression/save';
import { guardianAttack } from '../../src/enemies/guardianCombat';
import { groundHeight } from '../../src/world/level';
import { Geometry } from '../../src/assets/geometry';
import { GuardianView } from '../../src/world/GuardianView';
import { SanctuaryView } from '../../src/world/SanctuaryView';
import { createEnemyRig } from '../../src/assets/characters';
import { FollowCamera } from '../../src/camera/FollowCamera';

// Canvas textures are checked in Chromium; use the real geometry and poses here.
vi.mock('../../src/assets/surfaceTexture', () => ({ surfaceTexture: () => null }));

const idle: Commands = { x: 0, z: 0 };
function encounter(): Simulation {
  const save = freshSave();
  Object.assign(save, { checkpoint: 'before-guardian', reachedZone: 'guardian', hasKey: true, chestOpened: true,
    switchActivated: true, grateOpened: true, doorUnlocked: true, defeatedOrdinaryEnemies: ['sprout-1', 'sprout-2', 'spirit-1'] });
  const game = new Simulation(save); place(game, 0, 111.2); return game;
}
function place(g: Simulation, x: number, z: number): void {
  Object.assign(g.player, { x, z, y: groundHeight(x, z), vx: 0, vz: 0, vy: 0 });
}
function advance(g: Simulation, seconds: number, input: Commands = idle): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) g.step(1 / 60, { ...input, attack: i === 0 && !!input.attack, dodge: i === 0 && !!input.dodge });
}

describe('Guardian attacks and fair defence', () => {
  it('announces and alternates two attacks, each with a stationary recovery', () => {
    const g = encounter(), boss = g.enemies[3]!, seen = new Set<string>();
    for (let i = 0; i < 600; i++) { g.step(1 / 60, { ...idle, shield: true }); seen.add(`${boss.state}-${boss.attackIndex % 2}`); }
    for (const state of ['windup', 'attack', 'recover']) for (const index of [0, 1]) expect(seen.has(`${state}-${index}`)).toBe(true);
    expect(g.events.some(e => e.type === 'guardian-frontal-charge')).toBe(true);
    expect(g.events.some(e => e.type === 'guardian-slam-charge')).toBe(true);
    expect(g.player.health).toBe(8); // Frontal blocks; the one ground slam bypasses the shield.
  });

  it('locks direction before the frontal swing instead of following a late sidestep', () => {
    const g = encounter(), boss = g.enemies[3]!;
    advance(g, .7); const yaw = boss.yaw;
    place(g, 2.8, 114); advance(g, .6);
    expect(boss.yaw).toBeCloseTo(yaw);
    expect(g.player.health).toBe(10);
    expect(g.events.some(e => e.type === 'guardian-frontal-impact')).toBe(true);
  });

  it('emits impact and applies damage together, only once per swing', () => {
    const g = encounter(), boss = g.enemies[3]!;
    boss.state = 'attack'; boss.timer = 0;
    advance(g, .13); expect(g.player.health).toBe(10);
    expect(g.events.some(e => e.type.endsWith('-impact'))).toBe(false);
    advance(g, .05); expect(g.player.health).toBe(8);
    advance(g, .5); expect(g.player.health).toBe(8);
    expect(g.events.filter(e => e.type === 'guardian-frontal-impact')).toHaveLength(1);
  });

  it.each([['front', 0, 10], ['rear', Math.PI, 8]] as const)('respects the %s of Ruen’s shield', (_, yaw, health) => {
    const g = encounter(); g.player.yaw = yaw; g.enemies[3]!.state = 'attack';
    advance(g, .3, { ...idle, shield: true });
    expect(g.player.health).toBe(health);
    expect(g.events.some(e => e.type === 'guardian-block')).toBe(health === 10);
  });

  it('cannot hit outside the marked frontal sector or beyond its radius', () => {
    for (const [x, z] of [[0, 110.3], [0, 116.8], [2.8, 114]]) {
      const g = encounter(); place(g, x!, z!); g.enemies[3]!.state = 'attack';
      advance(g, .3); expect(g.player.health).toBe(10);
    }
  });

  it('a timely roll avoids a slam, while an early roll can end before impact', () => {
    const g = encounter(), boss = g.enemies[3]!;
    Object.assign(boss, { attackIndex: 1, state: 'attack', timer: .2 });
    advance(g, .1, { x: 0, z: 1, dodge: true });
    expect(g.player.health).toBe(10);
    expect(g.events.some(e => e.type === 'guardian-dodge')).toBe(true);
    const early = encounter(); Object.assign(early.enemies[3]!, { attackIndex: 1, state: 'windup', timer: 1 });
    advance(early, .7, { x: 0, z: 1, dodge: true });
    expect(early.player.health).toBe(8);
  });

  it('lets Ruen retreat out of the slam circle or jump over its ground impact', () => {
    const retreat = encounter(); Object.assign(retreat.enemies[3]!, { attackIndex: 1, state: 'windup', timer: 0 });
    advance(retreat, 1.7, { x: 0, z: -1 }); expect(retreat.player.health).toBe(10);
    const jumping = encounter(); Object.assign(jumping.enemies[3]!, { attackIndex: 1, state: 'attack' });
    jumping.step(1 / 60, { ...idle, jump: true });
    advance(jumping, .25); expect(jumping.player.health).toBe(10);
  });

  it('solid cover blocks both telegraph initiation and damage', () => {
    const g = encounter(), boss = g.enemies[3]!;
    place(g, 7, 106.5); Object.assign(boss, { x: 7, z: 109.5, home: { x: 7, z: 109.5 } });
    advance(g, 2); expect(boss.state).toBe('chase');
    for (const index of [0, 1]) {
      Object.assign(boss, { attackIndex: index, state: 'attack', timer: 0, hit: false });
      advance(g, .3); expect(g.player.health).toBe(10);
    }
  });

  it('cancels an attack on leaving the arena and gives a full warning on return', () => {
    const g = encounter(), boss = g.enemies[3]!;
    Object.assign(boss, { state: 'attack', timer: .14 }); place(g, 0, 93);
    advance(g, 1); expect(boss.state).toBe('idle'); expect(boss.timer).toBe(0);
    place(g, 0, 111.2); advance(g, .8);
    expect(boss.state).toBe('windup'); expect(g.player.health).toBe(10);
    expect(g.events.some(e => e.type === 'guardian-frontal-impact')).toBe(false);
  });

  it('gives enough recovery after a block for a real three-hit sword combo', () => {
    const g = encounter(), boss = g.enemies[3]!; place(g, 0, 111.9); g.targetId = boss.id;
    for (let i = 0; i < 180 && boss.state !== 'recover'; i++) g.step(1 / 60, { ...idle, shield: true });
    const position = { x: boss.x, z: boss.z };
    advance(g, .2, { ...idle, attack: true }); advance(g, .4, { ...idle, attack: true }); advance(g, .85, { ...idle, attack: true });
    expect(boss.hp).toBe(8); expect(boss.state).toBe('recover');
    expect({ x: boss.x, z: boss.z }).toEqual(position); expect(g.player.health).toBe(10);
  });
});

describe('Guardian defeat and restoration', () => {
  it('cancels a lethal swing, saves the unlocked altar and still requires interaction', () => {
    const g = encounter(), boss = g.enemies[3]!; boss.state = 'attack'; boss.timer = .14;
    g.damageEnemy(boss, 12); g.damageEnemy(boss, 1); advance(g, 1);
    expect(g.player.health).toBe(10); expect(g.mode).toBe('playing'); expect(g.save.completed).toBe(false);
    expect(g.events.filter(e => e.type === 'guardian-cleared')).toHaveLength(1);
    expect(new Simulation(g.save).altarReady).toBe(true);
    expect(parseSave(JSON.stringify(g.save))).not.toBeNull();
    place(g, 0, 125); expect(g.interact()).toBe(true);
    expect(g.mode).toBe('restoring'); expect(g.altarReady).toBe(false); expect(g.player.shield).toBe(false);
    advance(g, 1.5); expect(g.restorationProgress).toBeCloseTo(.5); expect(g.mode).toBe('restoring');
    expect(boss.timer).toBeGreaterThan(2);
    advance(g, 1.6); expect(g.mode).toBe('won'); expect(g.restorationProgress).toBe(1);
    expect(new Simulation(g.save).mode).toBe('won');
  });

  it('draws the exact attack boundaries, reuses effects, and clears them on death or a new game', () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      const geometry = new Geometry(scene), view = new GuardianView(geometry), finale = new SanctuaryView(geometry), g = encounter(), boss = g.enemies[3]!;
      const fog = scene.fogColor.clone(), count = scene.meshes.length;
      for (const index of [0, 1]) {
        Object.assign(boss, { attackIndex: index, state: 'windup', timer: .7 }); view.update(g);
        const attack = guardianAttack(index), node = scene.getTransformNodeByName(`guardian-${attack.kind}`)!;
        expect(node.isEnabled()).toBe(true);
        const positions = scene.getMeshByName(`guardian-${attack.kind}-fill`)!.getVerticesData(VertexBuffer.PositionKind)!;
        for (let i = 3; i < positions.length; i += 3) expect(Math.hypot(positions[i]!, positions[i + 2]!)).toBeCloseTo(attack.range);
      }
      g.damageEnemy(boss, 12); view.update(g); finale.update(g);
      expect(scene.getTransformNodeByName('guardian-slam')!.isEnabled()).toBe(false);
      expect(scene.getTransformNodeByName('altar-beacon')!.isEnabled()).toBe(true);
      place(g, 0, 125); g.interact(); advance(g, 1.5); finale.update(g);
      expect(scene.getMeshByName('restoration-wave')!.isEnabled()).toBe(true);
      expect(scene.fogColor.equals(fog)).toBe(false);
      for (let i = 0; i < 100; i++) { view.update(g); finale.update(g); }
      expect(scene.meshes).toHaveLength(count);
      finale.update(new Simulation()); view.update(new Simulation());
      expect(scene.fogColor.equals(fog)).toBe(true);
      expect(scene.getMeshByName('restoration-wave')!.isEnabled()).toBe(false);
      expect(scene.getTransformNodeByName('altar-beacon')!.isEnabled()).toBe(false);
    } finally { scene.dispose(); engine.dispose(); }
  });

  it('kneels on defeat and restores full visibility when the boss respawns', () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    try {
      const g = encounter(), rig = createEnemyRig(new Geometry(scene), 'guardian', 'guardian');
      g.damageEnemy(g.enemies[3]!, 12); advance(g, 1); rig.update(g.enemies[3]!, g.age);
      expect(rig.parts['body']!.position.y).toBeLessThan(-.8); expect(rig.root.scaling.y).toBe(1);
      advance(g, 1.3); rig.update(g.enemies[3]!, g.age); expect(rig.root.isEnabled()).toBe(false);
      rig.update(new Simulation(g.save).enemies[3]!, 0);
      expect(rig.root.isEnabled()).toBe(false); // Continuing must not replay a defeated boss.
      rig.update(encounter().enemies[3]!, 0); expect(rig.root.isEnabled()).toBe(true);
      expect(rig.root.getChildMeshes().every(m => m.visibility === 1)).toBe(true);
    } finally { scene.dispose(); engine.dispose(); }
  });
});

it.each([[800, 600, true], [390, 844, true], [800, 600, false], [390, 844, false]] as const)('frames the whole Guardian and Ruen at close range in %i × %i, locked: %s', (width, height, locked) => {
  const engine = new NullEngine({ renderWidth: width, renderHeight: height, textureSize: 512, deterministicLockstep: false, lockstepMaxSteps: 4 }), scene = new Scene(engine);
  try {
    const g = encounter(), camera = new FollowCamera(scene); place(g, 0, 111.9); g.targetId = locked ? 'guardian' : null; camera.reset(g);
    for (let i = 0; i < 120; i++) camera.update(g, 1 / 60, { x: 0, y: 0 }, 0);
    const matrix = camera.camera.getViewMatrix(true).multiply(camera.camera.getProjectionMatrix(true));
    for (const [x, y, z] of [[-1.7, .7, 114], [1.7, 4.9, 114], [-.5, .7, 111.9], [.5, 2.7, 111.9]]) {
      const point = Vector3.Project(new Vector3(x, y, z), Matrix.Identity(), matrix, new Viewport(0, 0, width, height));
      expect(point.x).toBeGreaterThan(10); expect(point.x).toBeLessThan(width - 10);
      expect(point.y).toBeGreaterThan(20); expect(point.y).toBeLessThan(height - 20);
    }
  } finally { scene.dispose(); engine.dispose(); }
});
