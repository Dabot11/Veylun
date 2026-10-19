import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import type { Geometry } from '../assets/geometry';
import type { Simulation } from '../core/Simulation';
import { groundHeight, interactables } from './level';

/** Altar guidance and a three-second restoration; every mesh is reused. */
export class SanctuaryView {
  private beacon: TransformNode;
  private wave: Mesh;
  private lights: Mesh[];
  private floor: number;
  private fog: Color3;
  private sky: Color4;
  constructor(private g: Geometry) {
    const altar = interactables['restoration-altar']; this.floor = groundHeight(altar.x, altar.z);
    this.fog = g.scene.fogColor.clone(); this.sky = g.scene.clearColor.clone();
    this.beacon = g.node('altar-beacon', undefined, [altar.x, this.floor, altar.z]);
    const beam = g.box('altar-light-column', this.beacon, [0, 2.7, 0], [.1, 4.5, .1], '#baffdf', .8);
    beam.material = g.mat('#baffdf', .8, .5);
    g.gem('altar-guide-diamond', this.beacon, [0, 5, 0], .28, '#fff0b5');
    const ring = CreateTorus('altar-ready-ring', { diameter: 3.4, thickness: .045, tessellation: 64 }, g.scene);
    g.place(ring, this.beacon, [0, .08, 0], [1, 1, 1], '#baffdf', 1);
    this.wave = CreateTorus('restoration-wave', { diameter: 2, thickness: .07, tessellation: 80 }, g.scene);
    g.place(this.wave, null, [altar.x, this.floor + .1, altar.z], [1, 1, 1], '#d9ffd5', 1);
    this.lights = Array.from({ length: 8 }, () => g.gem('restoration-light', null, [0, 0, 0], .12, '#d9ffd5'));
    this.beacon.setEnabled(false); this.wave.setEnabled(false); this.lights.forEach(m => m.setEnabled(false));
  }
  update(sim: Simulation): void {
    const progress = sim.restorationProgress, altar = interactables['restoration-altar'];
    this.beacon.setEnabled(sim.altarReady && sim.mode === 'playing');
    this.wave.setEnabled(sim.mode === 'restoring');
    this.wave.scaling.setAll(1 + progress * 10); this.wave.visibility = 1 - progress;
    this.lights.forEach((mesh, i) => {
      mesh.setEnabled(progress > 0);
      const angle = i * Math.PI / 4 + sim.age * .6, radius = 2.8 - progress * 2;
      mesh.position.set(altar.x + Math.sin(angle) * radius, this.floor + .5 + progress * 2.5 + Math.sin(angle * 2) * .3, altar.z + Math.cos(angle) * radius);
    });
    this.g.scene.fogColor.copyFrom(Color3.Lerp(this.fog, new Color3(.76, .85, .68), progress));
    this.g.scene.clearColor.copyFrom(Color4.Lerp(this.sky, new Color4(.76, .85, .72, 1), progress));
    const ambient = this.g.scene.getLightByName('forest-sky'), sun = this.g.scene.getLightByName('warm-sun');
    if (ambient) ambient.intensity = .78 + progress * .22;
    if (sun) sun.intensity = .9 + progress * .15;
  }
}
