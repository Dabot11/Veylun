import type { AnimationId } from '../assets/assetCatalog';
export type PlayerState = AnimationId;
export interface PlayerSnapshot {
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  state: PlayerState;
  health: number;
  grounded: boolean;
}
