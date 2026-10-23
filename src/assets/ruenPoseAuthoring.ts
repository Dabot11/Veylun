import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { InspectionModel } from './inspectModel';
import type { RuenEquippedLocomotion } from './ruenEquippedLocomotion';
import { ruenEquipmentProfiles, type RuenEquipmentKind } from './ruenEquipmentProfile';

export type RuenPoseProperty = 'position' | 'rotationQuaternion' | 'scaling';
export interface RuenPoseChannel { target: TransformNode; property: RuenPoseProperty; value: Vector3 | Quaternion }
export type RuenPose = Map<TransformNode, Quaternion>;
type Triple = readonly [number, number, number];
export interface RuenArmTarget {
  grip: Triple;
  blade?: Triple;
  face: Triple;
  /** Optional weapon-up and elbow directions for poses lying on the ground. */
  up?: Triple;
  elbow?: Triple;
}

// Cape hem extrema (master SHA-256 d662ef7c…32ad5db35, vertices50682/50668),
// measured in Spine2 space from the CPU-skinned mesh during the inverted roll.
// The cape joints retain their relative transforms, so these actual surface
// points follow Spine2 exactly and avoid an oversized whole-body support sphere.
const capeHemSupportPoints = [
  new Vector3(-0.00208360, -0.71478883, -0.18872253),
  new Vector3(-0.00404037, -0.71657682, -0.18561730),
];

/** Virtual forward kinematics: authoring never edits the visible/imported rig. */
export class RuenPoseBuilder {
  readonly rotations: RuenPose;
  readonly positions = new Map<TransformNode, Vector3>();
  private matrices = new Map<TransformNode, Matrix>();
  constructor(private readonly nodes: Map<string, TransformNode>, base: RuenPose, positions?: Map<TransformNode, Vector3>) {
    this.rotations = new Map([...base].map(([node, value]) => [node, value.clone()]));
    if (positions) for (const [node, value] of positions) this.positions.set(node, value.clone());
  }
  node(name: string): TransformNode {
    const node = this.nodes.get(name);
    if (!node) throw new Error(`Falta el joint de pose equipada «${name}».`);
    return node;
  }
  world(node: TransformNode): Matrix {
    const cached = this.matrices.get(node); if (cached) return cached;
    const local = Matrix.Compose(node.scaling, this.rotations.get(node) ?? node.rotationQuaternion ?? Quaternion.FromEulerVector(node.rotation), this.positions.get(node) ?? node.position);
    const matrix = node.parent instanceof TransformNode ? local.multiply(this.world(node.parent)) : local;
    this.matrices.set(node, matrix); return matrix;
  }
  position(node: TransformNode): Vector3 { return Vector3.TransformCoordinates(Vector3.Zero(), this.world(node)); }
  set(node: TransformNode, rotation: Quaternion): void {
    this.rotations.set(node, rotation.normalize()); this.matrices.clear();
  }
  private parentInverse(node: TransformNode): Matrix {
    return node.parent instanceof TransformNode ? Matrix.Invert(this.world(node.parent)) : Matrix.Identity();
  }
  orient(node: TransformNode, modelY: Vector3, modelZ: Vector3): void {
    const inverse = this.parentInverse(node);
    const y = Vector3.TransformNormal(modelY, inverse).normalize();
    let z = Vector3.TransformNormal(modelZ, inverse).normalize();
    const x = Vector3.Cross(y, z).normalize(); z = Vector3.Cross(x, y).normalize();
    if (x.lengthSquared() < 0.9) throw new Error('Los ejes de pose equipada no definen una orientación.');
    this.set(node, Quaternion.RotationQuaternionFromAxis(x, y, z));
  }
  rotateModel(name: string, axis: Vector3, radians: number): void {
    if (!radians) return;
    const node = this.node(name), world = this.world(node), delta = Matrix.RotationAxis(axis, radians);
    const y = Vector3.TransformNormal(Vector3.TransformNormal(Vector3.Up(), world), delta);
    const z = Vector3.TransformNormal(Vector3.TransformNormal(Vector3.Forward(), world), delta);
    this.orient(node, y, z);
  }
  aim(node: TransformNode, child: TransformNode, target: Vector3): void {
    const rotation = this.rotations.get(node) ?? node.rotationQuaternion!;
    const from = Vector3.TransformNormal(child.position, Matrix.Compose(node.scaling, rotation, Vector3.Zero())).normalize();
    const to = Vector3.TransformNormal(target.subtract(this.position(node)), this.parentInverse(node)).normalize();
    this.set(node, Quaternion.FromUnitVectorsToRef(from, to, Quaternion.Identity()).multiply(rotation));
  }
  setPosition(node: TransformNode, position: Vector3): void {
    this.positions.set(node, position.clone()); this.matrices.clear();
  }
  leg(side: 'Left' | 'Right', footTarget: Vector3, footOrientation?: Matrix, preserveKnee = false): void {
    const upper = this.node(`mixamorig:${side}UpLeg`), knee = this.node(`mixamorig:${side}Leg`), foot = this.node(`mixamorig:${side}Foot`);
    const footWorld = footOrientation ?? this.world(foot);
    const footY = Vector3.TransformNormal(Vector3.Up(), footWorld), footZ = Vector3.TransformNormal(Vector3.Forward(), footWorld);
    const origin = this.position(upper), middle = this.position(knee), end = this.position(foot);
    const a = Vector3.Distance(origin, middle), b = Vector3.Distance(middle, end);
    const delta = footTarget.subtract(origin), direction = delta.normalizeToNew();
    const reach = Math.min(a + b - 1e-5, Math.max(Math.abs(a - b) + 1e-5, delta.length()));
    const along = (a * a - b * b + reach * reach) / (2 * reach);
    const height = Math.sqrt(Math.max(0, a * a - along * along));
    const pole = preserveKnee ? middle.subtract(origin) : new Vector3(side === 'Left' ? -0.08 : 0.08, 0, 1);
    const bend = pole.subtract(direction.scale(Vector3.Dot(pole, direction))).normalize();
    this.aim(upper, knee, origin.add(direction.scale(along)).add(bend.scale(height)));
    this.aim(knee, foot, origin.add(direction.scale(reach)));
    this.orient(foot, footY, footZ);
  }
  weaponPoint(kind: RuenEquipmentKind, point: Vector3): Vector3 {
    const profile = ruenEquipmentProfiles.find(item => item.kind === kind)!;
    const mount = Matrix.Compose(Vector3.One().scale(profile.uniformScale), Quaternion.FromEulerAngles(...profile.rotation), Vector3.FromArray(profile.handOffset));
    return Vector3.TransformCoordinates(point.subtract(Vector3.FromArray(profile.grip)), mount.multiply(this.world(this.node(profile.hand))));
  }
  supportHeight(): number {
    let min = Infinity;
    for (const node of this.rotations.keys()) {
      const name = node.name;
      const radius = /HeadTop/.test(name) ? 0.08 : /:Head$/.test(name) ? 0.15 : /Spine2|:Hips$/.test(name) ? 0.16 :
        /ForeArm|:.*Arm$|:.*Leg$/.test(name) ? 0.08 : /Foot$/.test(name) ? 0.14 : /Toe/.test(name) ? 0.025 : 0.045;
      min = Math.min(min, this.position(node).y - radius);
    }
    const capeWorld = this.world(this.node('mixamorig:Spine2'));
    for (const point of capeHemSupportPoints) min = Math.min(min, Vector3.TransformCoordinates(point, capeWorld).y - 0.006);
    // Conservative exterior-root boxes include blade, hilt, rim and handle.
    // They do not alter equipment scale, grip or mounting transforms.
    for (const kind of ['sword', 'shield'] as const) {
      const bounds = kind === 'sword' ? [[-0.3, -0.95, -0.1], [0.3, 1.02, 0.1]] : [[-1, -1, -0.32], [1, 1, 0.16]];
      for (const x of [bounds[0]![0]!, bounds[1]![0]!]) for (const y of [bounds[0]![1]!, bounds[1]![1]!]) for (const z of [bounds[0]![2]!, bounds[1]![2]!]) {
        min = Math.min(min, this.weaponPoint(kind, new Vector3(x, y, z)).y);
      }
    }
    return min;
  }
  arm(side: 'Left' | 'Right', target: RuenArmTarget): void {
    const kind: RuenEquipmentKind = side === 'Right' ? 'sword' : 'shield';
    const profile = ruenEquipmentProfiles.find(item => item.kind === kind)!;
    const arm = this.node(`mixamorig:${side}Arm`), forearm = this.node(`mixamorig:${side}ForeArm`), hand = this.node(`mixamorig:${side}Hand`);
    const desiredY = target.blade ? Vector3.FromArray(target.blade).normalize().negate() : Vector3.FromArray(target.up ?? [0, 1, 0]).normalize();
    const desiredZ = Vector3.FromArray(target.face).normalize();
    const mount = Matrix.RotationYawPitchRoll(profile.rotation[1], profile.rotation[0], profile.rotation[2]);
    const mountY = Vector3.TransformNormal(Vector3.Up(), mount).normalize();
    const mountZ = Vector3.TransformNormal(Vector3.Forward(), mount).normalize();
    const mountFrame = Quaternion.RotationQuaternionFromAxis(Vector3.Cross(mountY, mountZ).normalize(), mountY, mountZ);
    const orientHand = () => {
      this.orient(hand, desiredY, desiredZ);
      this.set(hand, this.rotations.get(hand)!.multiply(mountFrame.conjugate()));
    };
    // Desired weapon axes define the palm's model-space offset, independently
    // of the current elbow. Solve the wrist to put the real handle in the palm.
    orientHand();
    const handOffset = Vector3.TransformNormal(Vector3.FromArray(profile.handOffset), this.world(hand));
    const wrist = Vector3.FromArray(target.grip).subtract(handOffset);
    const shoulder = this.position(arm), elbow = this.position(forearm), oldWrist = this.position(hand);
    const upperLength = Vector3.Distance(shoulder, elbow), lowerLength = Vector3.Distance(elbow, oldWrist);
    const delta = wrist.subtract(shoulder), distance = delta.length();
    if (upperLength < 1e-5 || lowerLength < 1e-5 || distance < 1e-5) throw new Error('El brazo no tiene longitudes válidas para pose equipada.');
    const direction = delta.scale(1 / distance);
    const reach = Math.max(Math.abs(upperLength - lowerLength) + 1e-5, Math.min(distance, upperLength + lowerLength - 1e-5));
    const along = (upperLength * upperLength - lowerLength * lowerLength + reach * reach) / (2 * reach);
    const height = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
    const pole = Vector3.FromArray(target.elbow ?? [side === 'Right' ? 0.65 : -0.65, 1.0, -0.12]).subtract(shoulder);
    let bend = pole.subtract(direction.scale(Vector3.Dot(pole, direction)));
    if (bend.lengthSquared() < 1e-8) bend = Vector3.Cross(direction, Vector3.Forward());
    bend.normalize();
    const elbowTarget = shoulder.add(direction.scale(along)).add(bend.scale(height));
    this.aim(arm, forearm, elbowTarget);
    this.aim(forearm, hand, shoulder.add(direction.scale(reach)));
    orientHand();
  }
}

export function collectRuenEquippedChannels(model: InspectionModel, scene: Scene, locomotion: RuenEquippedLocomotion): RuenPoseChannel[] {
  if (scene.isDisposed || model.root.isDisposed() || model.root.getScene() !== scene || locomotion.idle.getScene() !== scene) {
    throw new Error('La escena de pose equipada no está disponible.');
  }
  if (model.container.animationGroups.some(group => group.isStarted) || Object.values(locomotion).some(group => group.isStarted)) {
    throw new Error('Crea la pose equipada antes de reproducir cualquier animación.');
  }
  if (locomotion.idle.name !== 'Ruen_Idle_Equipped') throw new Error('La pose equipada requiere el Idle equipado de Ruen.');
  if (model.root.parent || !Matrix.Compose(model.root.scaling, model.root.rotationQuaternion ?? Quaternion.FromEulerVector(model.root.rotation), model.root.position)
    .equalsWithEpsilon(Matrix.Identity(), 1e-7)) throw new Error('Crea la pose equipada antes de transformar el contenedor exterior.');
  const skeleton = model.container.skeletons[0];
  if (model.container.skeletons.length !== 1 || skeleton?.name !== 'SmartRigArmature' || skeleton.bones.length !== 80) {
    throw new Error('La pose equipada requiere el rig original de Ruen de 80 huesos.');
  }
  for (const bone of skeleton.bones) {
    const node = bone.getTransformNode();
    if (!node || !node.rotationQuaternion || !Matrix.Compose(node.scaling, node.rotationQuaternion, node.position).equalsWithEpsilon(bone.getRestMatrix(), 1e-5)) {
      throw new Error(`La pose importada fue modificada en «${bone.name}».`);
    }
  }
  const channels: RuenPoseChannel[] = [], seen = new Set<string>();
  for (const { target, animation } of locomotion.idle.targetedAnimations) {
    const property = animation.targetProperty;
    if (!(target instanceof TransformNode) || !model.container.transformNodes.includes(target) || !['position', 'rotationQuaternion', 'scaling'].includes(property)) {
      throw new Error('Canal de locomoción no compatible con la pose equipada.');
    }
    const key = `${target.uniqueId}:${property}`;
    if (seen.has(key)) throw new Error('El Idle equipado contiene canales duplicados.');
    seen.add(key);
    const value = animation.getKeys()[0]?.value;
    if (!(value instanceof Quaternion || value instanceof Vector3) || !value.asArray().every(Number.isFinite)) throw new Error('Pose equipada no válida.');
    channels.push({ target, property: property as RuenPoseProperty, value: value.clone() });
  }
  return channels;
}
