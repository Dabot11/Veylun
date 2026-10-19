export interface V2 { x: number; z: number }
export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
export const distance = (a: V2, b: V2): number => Math.hypot(a.x - b.x, a.z - b.z);
export const angleTo = (a: V2, b: V2): number => Math.atan2(b.x - a.x, b.z - a.z);
export const angleDelta = (a: number, b: number): number => Math.atan2(Math.sin(b - a), Math.cos(b - a));
export const facing = (from: V2, yaw: number, to: V2, arc: number): boolean => Math.abs(angleDelta(yaw, angleTo(from, to))) <= arc / 2;
export function seededRandom(seed: number): () => number {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}
