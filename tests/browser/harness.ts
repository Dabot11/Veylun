import type { Simulation } from '../../src/core/Simulation';
import type { FollowCamera } from '../../src/camera/FollowCamera';

declare global {
  interface Window {
    __veylun: { sim: Simulation; camera: FollowCamera };
  }
}
