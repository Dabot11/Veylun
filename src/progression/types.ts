import type { OrdinaryEnemyId } from '../enemies/types';

export type ZoneId = 'awakening' | 'roots' | 'ruins' | 'gate' | 'guardian';
/** The start spawn is not counted as one of the two checkpoints. */
export type CheckpointId = 'start' | 'after-sprouts' | 'before-guardian';
/** Versioned save contract; validation and persistence live in save.ts. */
export interface SaveDataV1 {
  version: 1;
  checkpoint: CheckpointId;
  reachedZone: ZoneId;
  hasKey: boolean;
  chestOpened: boolean;
  switchActivated: boolean;
  grateOpened: boolean;
  doorUnlocked: boolean;
  defeatedOrdinaryEnemies: OrdinaryEnemyId[];
  bossDefeated: boolean;
  altarActivated: boolean;
  completed: boolean;
  playedSeconds: number;
  deaths: number;
}
