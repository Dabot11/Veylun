import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { GameEvent } from '../core/Simulation';
import type { Geometry } from '../assets/geometry';
import { groundHeight } from './level';

// Reuse four bursts even when one swing hits several enemies.
export class CombatEffects {
  private bursts: { age: number; strong: boolean; x: number; y: number; z: number; meshes: Mesh[] }[];
  private next = 0;
  constructor(g: Geometry) {
    this.bursts = Array.from({ length: 4 }, () => ({
      age: 1, strong: false, x: 0, y: 0, z: 0,
      meshes: Array.from({ length: 6 }, () => {
        const mesh = g.sphere('impact-spark', null, [0, 0, 0], [.07, .07, .07], '#fff0bb', 1, 3);
        mesh.setEnabled(false);
        return mesh;
      }),
    }));
  }
  emit(event: GameEvent): void {
    if (!['hit', 'shield', 'magic-impact'].includes(event.type) || event.x === undefined || event.z === undefined) return;
    const burst = this.bursts[this.next++ % this.bursts.length]!;
    Object.assign(burst, { age: 0, strong: !!event.strong, x: event.x, y: event.y ?? groundHeight(event.x, event.z) + .9, z: event.z });
    burst.meshes.forEach(mesh => mesh.setEnabled(true));
  }
  reset(): void {
    for (const burst of this.bursts) { burst.age = 1; burst.meshes.forEach(mesh => mesh.setEnabled(false)); }
  }
  update(dt: number): void {
    for (const burst of this.bursts) {
      if (burst.age >= .3) continue;
      burst.age += dt;
      burst.meshes.forEach((mesh, i) => {
        if (burst.age >= .3) { mesh.setEnabled(false); return; }
        const angle = i * Math.PI / 3, radius = .18 + burst.age * (burst.strong ? 3.8 : 2.6);
        mesh.position.set(burst.x + Math.sin(angle) * radius, burst.y + Math.sin(angle * 2 + .6) * radius * .65, burst.z + Math.cos(angle) * radius);
        mesh.scaling.setAll((burst.strong ? .11 : .075) * (1 - burst.age / .3));
      });
    }
  }
}
