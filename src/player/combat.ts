import { distance, facing, type V2 } from '../core/math';
export const attacks = [
  { windup: .14, activeEnd: .29, duration: .48, damage: 1 },
  { windup: .16, activeEnd: .32, duration: .5, damage: 1 },
  { windup: .23, activeEnd: .39, duration: .63, damage: 2 },
] as const;
export function swordHits(player: V2, yaw: number, y: number, target: V2 & { y: number; radius: number }): boolean {
  return distance(player, target) <= 1.55 + target.radius && Math.abs(y - target.y) < 1.7 && facing(player, yaw, target, Math.PI * .7);
}
export function shieldBlocks(player: V2, yaw: number, source: V2): boolean { return facing(player, yaw, source, 110 * Math.PI / 180); }
