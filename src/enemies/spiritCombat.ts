import type { V2 } from '../core/math';

/** Shared by the simulation, animation and spell telegraph. */
export const spiritCombat = {
  approachTime: 1.35,
  windup: .95,
  aimLockTime: .5,
  releaseTime: .18,
  recovery: 2.8,
  preferredRange: 6,
  projectileSpeed: 4.2,
  projectileRadius: .16,
  projectileHeight: 1,
  projectileLife: 4,
  muzzleOffset: .45,
} as const;

/** Earliest contact along the entire movement segment, including fast shots. */
export function segmentCircleEntry(from: V2, to: V2, center: V2, radius: number): number | undefined {
  const x = from.x - center.x, z = from.z - center.z;
  const dx = to.x - from.x, dz = to.z - from.z;
  const c = x * x + z * z - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dz * dz;
  if (a < 1e-12) return undefined;
  const b = x * dx + z * dz, discriminant = b * b - a * c;
  if (discriminant < 0) return undefined;
  const t = (-b - Math.sqrt(discriminant)) / a;
  return t >= 0 && t <= 1 ? t : undefined;
}

/** A shot that has passed Ruen or misses to the side no longer hides recovery advice. */
export function incomingMagic(shot: V2 & { y: number; vx: number; vz: number }, player: V2 & { y: number }): boolean {
  const dx=player.x-shot.x,dz=player.z-shot.z,speed=Math.hypot(shot.vx,shot.vz);
  if(speed<1e-6)return false;
  const along=(dx*shot.vx+dz*shot.vz)/speed,across=Math.abs(dx*shot.vz-dz*shot.vx)/speed;
  return along>=0&&along<12&&across<.8&&shot.y>=player.y-.16&&shot.y<=player.y+1.61;
}
