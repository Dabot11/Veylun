import { distance, facing, type V2 } from '../core/math';

/** One definition drives damage, poses, floor warnings and HUD timing. */
export const guardianCombat = {
  frontal: { kind: 'frontal', windup: 1.05, aimLock: .55, impact: .16, release: .5, recovery: 1.9, range: 3.6, arc: Math.PI * .75, height: 1.7, blockable: true },
  slam: { kind: 'slam', windup: 1.35, aimLock: .65, impact: .22, release: .65, recovery: 2.4, range: 4.3, arc: Math.PI * 2, height: .6, blockable: false },
  damage: 2,
  restorationDuration: 3,
} as const;

export const guardianAttack = (index: number) => index % 2 === 0 ? guardianCombat.frontal : guardianCombat.slam;

export function guardianHits(enemy: V2 & { y: number; yaw: number; attackIndex: number }, player: V2 & { y: number }): boolean {
  const attack = guardianAttack(enemy.attackIndex);
  return distance(enemy, player) < attack.range && player.y - enemy.y < attack.height &&
    (attack.kind === 'slam' || facing(enemy, enemy.yaw, player, attack.arc));
}
