import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import type { Geometry, XYZ } from '../assets/geometry';
import type { Simulation } from '../core/Simulation';
import { guardianAttack, guardianCombat } from '../enemies/guardianCombat';

/** Fixed outer boundaries match the actual hit area; inner light counts down. */
export class GuardianView {
  private frontal: TransformNode;
  private slam: TransformNode;
  private charge: Mesh;
  private recovery: Mesh;
  private wave: Mesh;

  constructor(g: Geometry) {
    this.frontal = this.area(g, 'guardian-frontal', guardianCombat.frontal.range, guardianCombat.frontal.arc, '#ffcd87');
    this.slam = this.area(g, 'guardian-slam', guardianCombat.slam.range, Math.PI * 2, '#ff9575');
    this.charge = this.ring(g, 'guardian-charge-clock', '#ffead0');
    this.recovery = this.ring(g, 'guardian-recovery', '#a9f2cf');
    this.recovery.scaling.setAll(1.6);
    this.wave = this.ring(g, 'guardian-impact-wave', '#ffdda5');
    for (const node of [this.frontal, this.slam, this.charge, this.recovery, this.wave]) node.setEnabled(false);
  }

  private ring(g: Geometry, name: string, color: string): Mesh {
    const mesh = CreateTorus(name, { diameter: 2, thickness: .035, tessellation: 64 }, g.scene);
    return g.place(mesh, null, [0, 0, 0], [1, 1, 1], color, .8);
  }

  private area(g: Geometry, name: string, radius: number, arc: number, color: string): TransformNode {
    const root = g.node(name), mesh = new Mesh(`${name}-fill`, g.scene), data = new VertexData();
    const positions = [0, 0, 0], indices: number[] = [], edge: XYZ[] = [];
    for (let i = 0; i <= 48; i++) {
      const angle = -arc / 2 + arc * i / 48, x = Math.sin(angle) * radius, z = Math.cos(angle) * radius;
      positions.push(x, 0, z); edge.push([x, 0, z]);
      if (i < 48) indices.push(0, i + 1, i + 2);
    }
    data.positions = positions; data.indices = indices; data.normals = [];
    VertexData.ComputeNormals(positions, indices, data.normals); data.applyToMesh(mesh);
    g.place(mesh, root, [0, 0, 0], [1, 1, 1], color, .6);
    mesh.material = g.mat(color, .6, .13);
    if (arc < Math.PI * 2) { edge.unshift([0, 0, 0]); edge.push([0, 0, 0]); }
    g.tube(`${name}-boundary`, root, edge, .035, color, .8);
    return root;
  }

  update(sim: Simulation): void {
    const enemy = sim.enemies[3]!;
    const visible = enemy.hp > 0 && sim.mode === 'playing' && sim.save.doorUnlocked && sim.player.z >= 94;
    const attack = guardianAttack(enemy.attackIndex);
    const warning = visible && (enemy.state === 'windup' || enemy.state === 'attack' && !enemy.hit);
    this.frontal.setEnabled(warning && attack.kind === 'frontal');
    this.slam.setEnabled(warning && attack.kind === 'slam');
    this.charge.setEnabled(warning);
    this.recovery.setEnabled(visible && enemy.state === 'recover');
    const impactTime = enemy.timer - attack.impact;
    this.wave.setEnabled(visible && attack.kind === 'slam' && enemy.state === 'attack' && enemy.hit && impactTime < .35);
    for (const node of [this.frontal, this.slam, this.charge, this.recovery, this.wave]) {
      node.position.set(enemy.x, enemy.y + .07, enemy.z); node.rotation.y = enemy.yaw;
    }
    const progress = enemy.state === 'windup' ? Math.min(1, enemy.timer / attack.windup) : 1;
    this.charge.scaling.setAll(.3 + progress * 1.15);
    this.wave.scaling.setAll(attack.range * Math.min(1, .25 + Math.max(0, impactTime) / .35));
    this.wave.visibility = Math.max(0, 1 - impactTime / .35);
  }
}
