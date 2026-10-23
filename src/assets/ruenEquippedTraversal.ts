import { Animation } from '@babylonjs/core/Animations/animation';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { gameConfig } from '../config/gameConfig';
import type { InspectionModel } from './inspectModel';
import type { RuenEquippedLocomotion } from './ruenEquippedLocomotion';
import { ruenEquipmentProfiles, type RuenEquipmentKind } from './ruenEquipmentProfile';

export type RuenTraversalState = 'jump' | 'fall' | 'land' | 'roll';
export type RuenEquippedTraversal = Record<RuenTraversalState, AnimationGroup>;
type Triple = readonly [number, number, number];
type Value = Vector3 | Quaternion;
type Property = 'position' | 'rotationQuaternion' | 'scaling';
interface Channel { target: TransformNode; property: Property; value: Value }
type Pose = Map<TransformNode, Quaternion>;
interface ArmTarget { grip: Triple; blade?: Triple; face: Triple }

export const ruenEquippedTraversalProfile = {
  fps: 60,
  duration: {
    jump: Math.sqrt(-2 * gameConfig.player.gravity * gameConfig.player.jumpHeight) / -gameConfig.player.gravity,
    fall: 0.3, land: 0.12, roll: gameConfig.combat.dodgeDuration,
  },
  names: { jump: 'Ruen_Jump_Equipped', fall: 'Ruen_Fall_Equipped', land: 'Ruen_Land_Equipped', roll: 'Ruen_Roll_Equipped' },
  rollTurnStart: 0.065,
  rollTurnEnd: 0.385,
} as const;
const smooth = (value: number): number => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
// Cape hem extrema (master SHA-256 d662ef7c…32ad5db35, vertices50682/50668),
// measured in Spine2 space from the CPU-skinned mesh during the inverted roll.
// The cape joints retain their relative transforms, so these actual surface
// points follow Spine2 exactly and avoid an oversized whole-body support sphere.
const capeHemSupportPoints = [
  new Vector3(-0.00208360, -0.71478883, -0.18872253),
  new Vector3(-0.00404037, -0.71657682, -0.18561730),
];

/** Virtual forward kinematics: authoring never edits the visible/imported rig. */
class TraversalPoseBuilder {
  readonly rotations: Pose;
  readonly positions = new Map<TransformNode, Vector3>();
  private matrices = new Map<TransformNode, Matrix>();
  constructor(private readonly nodes: Map<string, TransformNode>, base: Pose, positions?: Map<TransformNode, Vector3>) {
    this.rotations = new Map([...base].map(([node, value]) => [node, value.clone()]));
    if (positions) for (const [node, value] of positions) this.positions.set(node, value.clone());
  }
  node(name: string): TransformNode {
    const node = this.nodes.get(name);
    if (!node) throw new Error(`Falta el joint de recorrido «${name}».`);
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
    if (x.lengthSquared() < 0.9) throw new Error('Los ejes de recorrido no definen una orientación.');
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
  arm(side: 'Left' | 'Right', target: ArmTarget): void {
    const kind: RuenEquipmentKind = side === 'Right' ? 'sword' : 'shield';
    const profile = ruenEquipmentProfiles.find(item => item.kind === kind)!;
    const arm = this.node(`mixamorig:${side}Arm`), forearm = this.node(`mixamorig:${side}ForeArm`), hand = this.node(`mixamorig:${side}Hand`);
    const desiredY = target.blade ? Vector3.FromArray(target.blade).normalize().negate() : Vector3.Up();
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
    if (upperLength < 1e-5 || lowerLength < 1e-5 || distance < 1e-5) throw new Error('El brazo no tiene longitudes válidas para recorrido.');
    const direction = delta.scale(1 / distance);
    const reach = Math.max(Math.abs(upperLength - lowerLength) + 1e-5, Math.min(distance, upperLength + lowerLength - 1e-5));
    const along = (upperLength * upperLength - lowerLength * lowerLength + reach * reach) / (2 * reach);
    const height = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
    const pole = new Vector3(side === 'Right' ? 0.65 : -0.65, 1.0, -0.12).subtract(shoulder);
    let bend = pole.subtract(direction.scale(Vector3.Dot(pole, direction)));
    if (bend.lengthSquared() < 1e-8) bend = Vector3.Cross(direction, Vector3.Forward());
    bend.normalize();
    const elbowTarget = shoulder.add(direction.scale(along)).add(bend.scale(height));
    this.aim(arm, forearm, elbowTarget);
    this.aim(forearm, hand, shoulder.add(direction.scale(reach)));
    orientHand();
  }
}

function channelsAndRest(model: InspectionModel, scene: Scene, locomotion: RuenEquippedLocomotion): Channel[] {
  if (scene.isDisposed || model.root.isDisposed() || model.root.getScene() !== scene || locomotion.idle.getScene() !== scene) {
    throw new Error('La escena de recorrido no está disponible.');
  }
  if (model.container.animationGroups.some(group => group.isStarted) || Object.values(locomotion).some(group => group.isStarted)) {
    throw new Error('Crea el recorrido antes de reproducir cualquier animación.');
  }
  if (locomotion.idle.name !== 'Ruen_Idle_Equipped') throw new Error('El recorrido requiere el Idle equipado de Ruen.');
  if (model.root.parent || !Matrix.Compose(model.root.scaling, model.root.rotationQuaternion ?? Quaternion.FromEulerVector(model.root.rotation), model.root.position)
    .equalsWithEpsilon(Matrix.Identity(), 1e-7)) throw new Error('Crea el recorrido antes de transformar el contenedor exterior.');
  const skeleton = model.container.skeletons[0];
  if (model.container.skeletons.length !== 1 || skeleton?.name !== 'SmartRigArmature' || skeleton.bones.length !== 80) {
    throw new Error('El recorrido requiere el rig original de Ruen de 80 huesos.');
  }
  for (const bone of skeleton.bones) {
    const node = bone.getTransformNode();
    if (!node || !node.rotationQuaternion || !Matrix.Compose(node.scaling, node.rotationQuaternion, node.position).equalsWithEpsilon(bone.getRestMatrix(), 1e-5)) {
      throw new Error(`La pose importada fue modificada en «${bone.name}».`);
    }
  }
  const channels: Channel[] = [], seen = new Set<string>();
  for (const { target, animation } of locomotion.idle.targetedAnimations) {
    const property = animation.targetProperty;
    if (!(target instanceof TransformNode) || !model.container.transformNodes.includes(target) || !['position', 'rotationQuaternion', 'scaling'].includes(property)) {
      throw new Error('Canal de locomoción no compatible con el recorrido.');
    }
    const key = `${target.uniqueId}:${property}`;
    if (seen.has(key)) throw new Error('El Idle equipado contiene canales duplicados.');
    seen.add(key);
    const value = animation.getKeys()[0]?.value;
    if (!(value instanceof Quaternion || value instanceof Vector3) || !value.asArray().every(Number.isFinite)) throw new Error('Pose de recorrido no válida.');
    channels.push({ target, property: property as Property, value: value.clone() });
  }
  return channels;
}

/**
 * Creates four stopped caller-owned clips on the unmodified imported rig.
 * Register them with the model for reset/disposal. The controller supplies the
 * physical jump trajectory and roll direction; these clips move no exterior
 * root and add no lateral translation. Only the internal pelvis articulates.
 */
export function createRuenEquippedTraversal(
  model: InspectionModel, scene: Scene, locomotion: RuenEquippedLocomotion,
): RuenEquippedTraversal {
  const channels = channelsAndRest(model, scene, locomotion);
  if (channels.length !== 160) throw new Error('El recorrido requiere los 160 canales locales originales.');
  for (const name of Object.values(ruenEquippedTraversalProfile.names)) {
    if (scene.animationGroups.some(group => group.name === name)) throw new Error(`La escena ya contiene «${name}».`);
  }
  const nodes = new Map(model.container.transformNodes.map(node => [node.name, node]));
  const base = new Map(channels.filter(channel => channel.property === 'rotationQuaternion').map(channel => [channel.target, (channel.value as Quaternion).clone()]));
  const idle = new TraversalPoseBuilder(nodes, base);
  const hips = idle.node('mixamorig:Hips'), hipRest = hips.position.clone();
  const feet = new Map((['Left', 'Right'] as const).map(side => [side, idle.position(idle.node(`mixamorig:${side}Foot`))]));
  const mix = (a: TraversalPoseBuilder, b: TraversalPoseBuilder, weight: number): TraversalPoseBuilder => {
    const t = Math.max(0, Math.min(1, weight)), pose = new TraversalPoseBuilder(nodes, base);
    if (t === 0) return new TraversalPoseBuilder(nodes, a.rotations, a.positions);
    if (t === 1) return new TraversalPoseBuilder(nodes, b.rotations, b.positions);
    for (const [node, rotation] of a.rotations) pose.set(node, Quaternion.Slerp(rotation, b.rotations.get(node)!, t));
    for (const node of new Set([...a.positions.keys(), ...b.positions.keys()])) {
      pose.setPosition(node, Vector3.Lerp(a.positions.get(node) ?? node.position, b.positions.get(node) ?? node.position, t));
    }
    return pose;
  };
  const makePose = (drop: number, tuck: number, pitch: number, compact: boolean): TraversalPoseBuilder => {
    const pose = new TraversalPoseBuilder(nodes, base);
    pose.setPosition(hips, hipRest.add(new Vector3(0, -drop, 0)));
    pose.rotateModel('mixamorig:Spine', Vector3.Right(), pitch * 0.5 * Math.PI / 180);
    pose.rotateModel('mixamorig:Spine1', Vector3.Right(), pitch * 0.3 * Math.PI / 180);
    pose.rotateModel('mixamorig:Spine2', Vector3.Right(), pitch * 0.2 * Math.PI / 180);
    if (compact) pose.rotateModel('mixamorig:Neck', Vector3.Right(), 18 * Math.PI / 180);
    for (const side of ['Left', 'Right'] as const) {
      const foot = feet.get(side)!.add(new Vector3(0, tuck, -tuck * 0.25));
      pose.leg(side, foot);
    }
    const y = hipRest.y - drop;
    if (compact) {
      pose.arm('Right', { grip: [0.28, y + 0.25, 0.39], blade: [-1, 0, 0.04], face: [0, 0.2, 1] });
      pose.arm('Left', { grip: [-0.21, y + 0.15, 0.17], face: [0, 0.35, 1] });
    } else {
      pose.arm('Right', { grip: [0.30, y + 0.23, 0.18], blade: [0.28, -0.63, 0.72], face: [0, 0.3, 1] });
      pose.arm('Left', { grip: [-0.24, y + 0.25, 0.23], face: [-0.15, 0.05, 1] });
    }
    return pose;
  };
  const apex = makePose(0, 0.25, 5, false);
  const falling = makePose(0.025, 0, 3, false);
  const impact = makePose(0.16, 0, 13, false);
  const crouch = makePose(0.25, 0, 30, true);
  const ball = makePose(0.33, 0.28, 68, true);
  const plantFeet = (pose: TraversalPoseBuilder, tuck = 0): TraversalPoseBuilder => {
    // Blending bent-leg quaternions alone pulls the sole below its contact
    // plane. Re-solve each sample, retaining its knee plane and foot orientation.
    for (const side of ['Left', 'Right'] as const) {
      pose.leg(side, feet.get(side)!.add(new Vector3(0, tuck, -tuck * 0.25)),
        idle.world(idle.node(`mixamorig:${side}Foot`)), true);
    }
    return pose;
  };
  const poseAt = (state: RuenTraversalState, time: number): TraversalPoseBuilder => {
    const duration = ruenEquippedTraversalProfile.duration[state];
    if (state === 'jump') return mix(idle, apex, smooth(time / duration));
    if (state === 'fall') return mix(apex, falling, smooth(time / (duration * 0.8)));
    if (state === 'land') return plantFeet(time <= 0.04 ? mix(falling, impact, smooth(time / 0.04)) : mix(impact, idle, smooth((time - 0.04) / (duration - 0.04))));
    const start = ruenEquippedTraversalProfile.rollTurnStart, end = ruenEquippedTraversalProfile.rollTurnEnd;
    if (time <= start) return plantFeet(mix(idle, crouch, smooth(time / start)));
    if (time >= end) return plantFeet(mix(crouch, idle, smooth((time - end) / (duration - end))));
    const tuck = Math.min(smooth((time - start) / 0.06), smooth((end - time) / 0.06));
    const pose = plantFeet(mix(crouch, ball, tuck), 0.28 * tuck);
    // Evaluate the full angle at each dense key. Interpolating only identical
    // 0/360 quaternions would erase the turn through shortest-path slerp.
    pose.rotateModel('mixamorig:Hips', Vector3.Right(), Math.PI * 2 * smooth((time - start) / (end - start)));
    // Internal support adjustment keeps the curled silhouette and carried gear
    // above the floor; it is independent from the controller's world trajectory.
    const position = pose.positions.get(hips)!.clone();
    const supportWeight = Math.min(smooth((time - start) / 0.025), smooth((end - time) / 0.025));
    position.y += (0.025 - pose.supportHeight()) * supportWeight;
    pose.setPosition(hips, position);
    return pose;
  };
  const groups: Partial<RuenEquippedTraversal> = {};
  try {
    for (const state of Object.keys(ruenEquippedTraversalProfile.names) as RuenTraversalState[]) {
      const duration = ruenEquippedTraversalProfile.duration[state];
      // Quarter-frame keys keep nonlinear planted-foot IK within a millimetre
      // between samples while retaining ordinary 60-fps playback units.
      const rate = state === 'roll' || state === 'land' ? 240 : ruenEquippedTraversalProfile.fps;
      const markers = state === 'land' ? [0.04] : state === 'fall' ? [duration * 0.8] : state === 'roll' ?
        [ruenEquippedTraversalProfile.rollTurnStart, ruenEquippedTraversalProfile.rollTurnEnd, duration / 2] : [];
      const times = [...new Set([0, duration, ...markers, ...Array.from({ length: Math.ceil(duration * rate) }, (_, index) => Math.min(duration, index / rate))])].sort((a, b) => a - b);
      const poses = times.map(time => poseAt(state, time));
      // Near an almost straight knee, even a short slerp can move the sole.
      // Subdivide only those contact intervals whose actual midpoint drifts.
      for (let index = 0; index < times.length - 1;) {
        const from = times[index]!, to = times[index + 1]!, middle = (from + to) / 2;
        const contact = state === 'land' || state === 'roll' &&
          (to <= ruenEquippedTraversalProfile.rollTurnStart || from >= ruenEquippedTraversalProfile.rollTurnEnd);
        const interpolated = contact ? mix(poses[index]!, poses[index + 1]!, 0.5) : undefined;
        const drifting = interpolated && (['Left', 'Right'] as const).some(side =>
          Vector3.Distance(interpolated.position(interpolated.node(`mixamorig:${side}Foot`)), feet.get(side)!) > 0.0005);
        if (drifting && to - from > 1 / 15360) {
          times.splice(index + 1, 0, middle); poses.splice(index + 1, 0, poseAt(state, middle));
        } else index++;
      }
      const group = new AnimationGroup(ruenEquippedTraversalProfile.names[state], scene); groups[state] = group;
      for (const channel of channels) {
        const rotation = channel.property === 'rotationQuaternion';
        const animation = new Animation(`${group.name}:${channel.target.name}:${channel.property}`, channel.property, ruenEquippedTraversalProfile.fps,
          rotation ? Animation.ANIMATIONTYPE_QUATERNION : Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CYCLE);
        animation.setKeys(times.map((time, index) => ({ frame: time * ruenEquippedTraversalProfile.fps,
          value: rotation ? poses[index]!.rotations.get(channel.target)!.clone() :
            channel.property === 'position' ? (poses[index]!.positions.get(channel.target) ?? channel.value).clone() : channel.value.clone(),
        })));
        group.addTargetedAnimation(animation, channel.target);
      }
      group.from = 0; group.to = duration * ruenEquippedTraversalProfile.fps;
    }
    return groups as RuenEquippedTraversal;
  } catch (error) {
    for (const group of Object.values(groups)) group?.dispose();
    throw error;
  }
}
