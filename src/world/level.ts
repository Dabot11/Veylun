import type { V2 } from '../core/math';
import type { SaveDataV1, CheckpointId, ZoneId } from '../progression/types';
export interface Obstacle { id: string; x: number; z: number; w: number; d: number; height: number; kind: 'tree' | 'rock' | 'wall' | 'gate' | 'grate' | 'seal' | 'pillar' }
export const zones: { id: ZoneId; name: string; z: number }[] = [
  { id: 'awakening', name: 'Claro del despertar', z: 0 },
  { id: 'roots', name: 'Sendero de las raíces', z: 29 },
  { id: 'ruins', name: 'Patio de las ruinas', z: 59 },
  { id: 'gate', name: 'Puerta del santuario', z: 85 },
  { id: 'guardian', name: 'Cámara del Guardián', z: 113 },
];
export const checkpoints: Record<CheckpointId, V2> = { start: { x: 0, z: 0 }, 'after-sprouts': { x: 0, z: 42 }, 'before-guardian': { x: 0, z: 85 } };
export const interactables = { 'ruins-switch': { x: -4, z: 60 }, 'key-chest': { x: 10, z: 61 }, 'sanctuary-door': { x: 0, z: 88 }, 'restoration-altar': { x: 0, z: 126 } };
export function groundHeight(x: number, z: number): number {
  return 0.12 * Math.sin(z * 0.13) * Math.min(1, Math.abs(x) / 5) + (z > 79 && z < 87 ? (z - 79) / 8 * 0.6 : z >= 87 ? 0.6 : 0);
}
export const obstacles: Obstacle[] = [
  { id: 'root-seal', x: 0, z: 41, w: 30, d: .6, height: 4, kind: 'seal' },
  { id: 'gate-left-wall', x: -9, z: 90, w: 12, d: .8, height: 6, kind: 'wall' },
  { id: 'gate-right-wall', x: 9, z: 90, w: 12, d: .8, height: 6, kind: 'wall' },
  { id: 'sanctuary-door', x: 0, z: 90, w: 30, d: 0.8, height: 6, kind: 'gate' },
  { id: 'grate', x: 10, z: 57, w: 6, d: 0.3, height: 3.8, kind: 'grate' },
  { id: 'cage-left', x: 6.8, z: 61, w: 0.6, d: 8.6, height: 3.8, kind: 'wall' },
  { id: 'cage-right', x: 13.2, z: 61, w: 0.6, d: 8.6, height: 3.8, kind: 'wall' },
  { id: 'cage-back', x: 10, z: 65, w: 6.8, d: 0.6, height: 3.8, kind: 'wall' },
];
for (let i = 0; i < 36; i++) {
  const z = -7 + i * 3.8;
  for (const side of [-1, 1]) if(!(side===1&&z>49&&z<68)) obstacles.push({ id: `tree-${i}-${side}`, x: side * (10.5 + Math.sin(i * 3.9) * 2.4), z, w: 1.2 + (i % 3) * .3, d: 1.4, height: 9, kind: 'tree' });
}
for (const [x, z] of [[-5, 12], [6, 19], [-7, 36], [5, 46], [-6, 74], [6, 81], [-9, 105], [10, 120]]) {
  if (x !== undefined && z !== undefined) obstacles.push({ id: `rock-${z}`, x, z, w: 2.2, d: 2, height: 2.4, kind: 'rock' });
}
for (const zone of zones) for (const x of [-7,7]) for (const offset of [-5,5]) obstacles.push({id:`pillar-${x}-${zone.z+offset}`,x,z:zone.z+offset,w:.85,d:.85,height:4,kind:'pillar'});
for(const [z,x]of [[15,3.2],[43,3.1],[90,4.1]])for(const side of [-1,1])obstacles.push({id:`arch-${z}-${side}`,x:x!*side,z:z!,w:.85,d:.85,height:5,kind:'pillar'});
export function solid(o: Obstacle, save: SaveDataV1): boolean {
  if(o.kind==='seal')return !(save.defeatedOrdinaryEnemies.includes('sprout-1')&&save.defeatedOrdinaryEnemies.includes('sprout-2'));
  return !(o.kind === 'gate' && save.doorUnlocked) && !(o.kind === 'grate' && save.grateOpened);
}
/** Axis-separated swept substeps avoid tunneling during rolls and charges. */
export function moveWithCollisions(pos: V2, dx: number, dz: number, radius: number, y: number, save: SaveDataV1): V2 {
  let x = pos.x, z = pos.z;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .18));
  const blocked = (nx: number, nz: number): boolean => obstacles.some(o => solid(o, save) && y < groundHeight(o.x, o.z) + o.height && Math.abs(nx - o.x) < o.w / 2 + radius && Math.abs(nz - o.z) < o.d / 2 + radius);
  for (let i = 0; i < steps; i++) {
    if (!blocked(x + dx / steps, z)) x += dx / steps;
    if (!blocked(x, z + dz / steps)) z += dz / steps;
    x = Math.max(-14, Math.min(14, x)); z = Math.max(-10, Math.min(132, z));
  }
  return { x, z };
}
