import { attacks } from './combat';

type Pose = { x: number; y: number; z: number; torso: number };
const rest: Pose = { x: 0, y: 0, z: -.07, torso: 0 };

function blend(a: Pose, b: Pose, progress: number): Pose {
  const t = Math.max(0, Math.min(1, progress));
  const smooth = t * t * (3 - 2 * t);
  return {
    x: a.x + (b.x - a.x) * smooth,
    y: a.y + (b.y - a.y) * smooth,
    z: a.z + (b.z - a.z) * smooth,
    torso: a.torso + (b.torso - a.torso) * smooth,
  };
}

/** Ruen's arm and blade point down at rest: negative X swings them forward. */
export function attackPose(combo: number, time: number): Pose {
  const attack = attacks[combo - 1];
  if (!attack || time < 0) return rest;
  const direction = combo === 2 ? -1 : 1;
  const ready: Pose = combo === 3
    ? { x: -2.1, y: 0, z: -.12, torso: 0 }
    : { x: -1.35, y: direction * .65, z: -.12, torso: direction * .12 };
  const follow: Pose = combo === 3
    ? { x: -1.05, y: 0, z: -.12, torso: 0 }
    : { x: -1.55, y: -direction * .65, z: .12, torso: -direction * .12 };
  if (time < attack.windup) return blend(rest, ready, time / attack.windup);
  if (time < attack.activeEnd) {
    return blend(ready, follow, (time - attack.windup) / (attack.activeEnd - attack.windup));
  }
  return blend(follow, rest, (time - attack.activeEnd) / (attack.duration - attack.activeEnd));
}
