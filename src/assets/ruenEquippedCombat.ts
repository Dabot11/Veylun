import { Animation } from '@babylonjs/core/Animations/animation';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { attacks } from '../player/combat';
import type { InspectionModel } from './inspectModel';
import type { RuenEquippedLocomotion } from './ruenEquippedLocomotion';
import { ruenEquipmentProfiles, type RuenEquipmentKind } from './ruenEquipmentProfile';

export type RuenCombatState = 'shield' | 'block' | 'attack1' | 'attack2' | 'attack3';
export type RuenEquippedCombat = Record<RuenCombatState, AnimationGroup>;
type Triple = readonly [number, number, number];
type Value = Vector3 | Quaternion;
type Property = 'position' | 'rotationQuaternion' | 'scaling';
interface Channel { target: TransformNode; property: Property; value: Value }
type Pose = Map<TransformNode, Quaternion>;

export const ruenEquippedCombatProfile = {
  fps: 60,
  guardLoopSeconds: 4,
  blockSeconds: 0.22,
  blockPeakSeconds: 0.07,
  names: {
    shield: 'Ruen_Guard_Equipped', block: 'Ruen_Block_Equipped',
    attack1: 'Ruen_Attack1_Equipped', attack2: 'Ruen_Attack2_Equipped', attack3: 'Ruen_Attack3_Equipped',
  },
  attacks: attacks.map((attack, index) => ({
    name: `Ruen_Attack${index + 1}_Equipped`, windup: attack.windup,
    activeEnd: attack.activeEnd, duration: attack.duration,
  })),
} as const;

interface ArmTarget {
  /** Palm/grip center and weapon axes, AFTER glTF conversion, before game scale. */
  grip: Triple;
  /** Sword tip direction. The sword's raw tip points along -Y. */
  blade?: Triple;
  /** Broad face normal for sword, decorated front normal for shield. */
  face: Triple;
}
interface KeyPose {
  time: number;
  idle?: true;
  yaw?: number;
  pitch?: number;
  right?: ArmTarget;
  left?: ArmTarget;
}
const idleKey = (time: number): KeyPose => ({ time, idle: true });
const attackShield: ArmTarget = { grip: [-0.33, 1.12, 0.11], face: [-0.2, 0, 1] };
const guardShield: ArmTarget = { grip: [-0.13, 1.27, 0.36], face: [0.06, 0.03, 1] };
const guardSword: ArmTarget = { grip: [0.31, 1.03, 0.13], blade: [0.27, -0.73, 0.63], face: [0, 0.25, 1] };

/** Art directions at exact gameplay markers, not damage events or controller data. */
export const ruenCombatPoseTargets: Readonly<Record<RuenCombatState, readonly KeyPose[]>> = {
  shield: [{ time: 0, pitch: 2, right: guardSword, left: guardShield }],
  block: [
    { time: 0, pitch: 2, right: guardSword, left: guardShield },
    { time: 0.07, pitch: -3, right: guardSword, left: { grip: [-0.12, 1.26, 0.25], face: [0.08, 0.12, 1] } },
    { time: 0.13, pitch: 3, right: guardSword, left: { grip: [-0.13, 1.27, 0.39], face: [0.06, 0.01, 1] } },
    { time: 0.22, pitch: 2, right: guardSword, left: guardShield },
  ],
  attack1: [
    idleKey(0),
    { time: 0.045, yaw: -6, pitch: -2, right: { grip: [0.37, 1.20, 0.06], blade: [0.48, 0.75, 0.46], face: [0.1, 0, 1] } },
    { time: attacks[0].windup, yaw: -14, pitch: -2, right: { grip: [0.43, 1.32, 0.13], blade: [0.43, 0.72, 0.54], face: [0.1, 0, 1] } },
    { time: (attacks[0].windup + attacks[0].activeEnd) / 2, yaw: 5, pitch: 4, right: { grip: [0.26, 1.22, 0.34], blade: [-0.35, -0.10, 0.93], face: [0, 1, 0] } },
    { time: attacks[0].activeEnd, yaw: 14, pitch: 5, right: { grip: [0.06, 1.04, 0.32], blade: [-0.65, -0.65, 0.4], face: [0, 1, 0.2] } },
    { time: 0.38, yaw: 5, pitch: 1, right: { grip: [0.18, 1.03, 0.23], blade: [0.16, -0.82, 0.55], face: [0, 0.2, 1] } },
    idleKey(attacks[0].duration),
  ],
  attack2: [
    idleKey(0),
    { time: 0.055, yaw: 4, pitch: 2, right: { grip: [0.14, 1.04, 0.25], blade: [-0.66, -0.65, 0.37], face: [0.1, 0.4, 1] } },
    { time: attacks[1].windup, yaw: 12, pitch: 3, right: { grip: [0.07, 1.07, 0.29], blade: [-0.71, -0.50, 0.49], face: [0, 0.9, 0.2] } },
    { time: (attacks[1].windup + attacks[1].activeEnd) / 2, yaw: -3, pitch: 1, right: { grip: [0.27, 1.20, 0.34], blade: [0.35, 0.12, 0.93], face: [0, 1, 0] } },
    { time: attacks[1].activeEnd, yaw: -12, pitch: -2, right: { grip: [0.43, 1.35, 0.17], blade: [0.55, 0.65, 0.52], face: [0, 1, 0.2] } },
    { time: 0.40, yaw: -4, right: { grip: [0.42, 1.18, 0.20], blade: [0.75, -0.10, 0.65], face: [0, 0.4, 1] } },
    idleKey(attacks[1].duration),
  ],
  attack3: [
    idleKey(0),
    { time: 0.075, pitch: -2, right: { grip: [0.37, 1.30, 0.10], blade: [0.22, 0.92, 0.32], face: [1, 0, 0] } },
    { time: attacks[2].windup, yaw: -2, pitch: -5, right: { grip: [0.26, 1.53, 0.17], blade: [0.02, 0.99, -0.14], face: [1, 0, 0] } },
    { time: (attacks[2].windup + attacks[2].activeEnd) / 2, yaw: 1, pitch: 7, right: { grip: [0.19, 1.31, 0.34], blade: [0.04, -0.24, 0.97], face: [1, 0, 0] } },
    { time: attacks[2].activeEnd, pitch: 10, right: { grip: [0.23, 1.10, 0.34], blade: [0.08, -0.91, 0.40], face: [1, 0, 0] } },
    { time: 0.50, pitch: 3, right: { grip: [0.30, 1.01, 0.22], blade: [0.23, -0.82, 0.52], face: [0.2, 0, 1] } },
    idleKey(attacks[2].duration),
  ],
};

/** Virtual forward kinematics: authoring never edits the visible/imported rig. */
class PoseBuilder {
  readonly rotations: Pose;
  private matrices = new Map<TransformNode, Matrix>();
  constructor(private readonly nodes: Map<string, TransformNode>, base: Pose) {
    this.rotations = new Map([...base].map(([node, value]) => [node, value.clone()]));
  }
  node(name: string): TransformNode {
    const node = this.nodes.get(name);
    if (!node) throw new Error(`Falta el joint de combate «${name}».`);
    return node;
  }
  world(node: TransformNode): Matrix {
    const cached = this.matrices.get(node); if (cached) return cached;
    const local = Matrix.Compose(node.scaling, this.rotations.get(node) ?? node.rotationQuaternion ?? Quaternion.FromEulerVector(node.rotation), node.position);
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
    if (x.lengthSquared() < 0.9) throw new Error('Los ejes de combate no definen una orientación.');
    this.set(node, Quaternion.RotationQuaternionFromAxis(x, y, z));
  }
  rotateModel(name: string, axis: Vector3, radians: number): void {
    if (!radians) return;
    const node = this.node(name), world = this.world(node), delta = Matrix.RotationAxis(axis, radians);
    const y = Vector3.TransformNormal(Vector3.TransformNormal(Vector3.Up(), world), delta);
    const z = Vector3.TransformNormal(Vector3.TransformNormal(Vector3.Forward(), world), delta);
    this.orient(node, y, z);
  }
  private aim(node: TransformNode, child: TransformNode, target: Vector3): void {
    const rotation = this.rotations.get(node) ?? node.rotationQuaternion!;
    const from = Vector3.TransformNormal(child.position, Matrix.Compose(node.scaling, rotation, Vector3.Zero())).normalize();
    const to = Vector3.TransformNormal(target.subtract(this.position(node)), this.parentInverse(node)).normalize();
    this.set(node, Quaternion.FromUnitVectorsToRef(from, to, Quaternion.Identity()).multiply(rotation));
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
    if (upperLength < 1e-5 || lowerLength < 1e-5 || distance < 1e-5) throw new Error('El brazo no tiene longitudes válidas para combate.');
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
    throw new Error('La escena de combate no está disponible.');
  }
  if (model.container.animationGroups.some(group => group.isStarted) || Object.values(locomotion).some(group => group.isStarted)) {
    throw new Error('Crea el combate antes de reproducir cualquier animación.');
  }
  if (locomotion.idle.name !== 'Ruen_Idle_Equipped') throw new Error('El combate requiere el Idle equipado de Ruen.');
  if (model.root.parent || !Matrix.Compose(model.root.scaling, model.root.rotationQuaternion ?? Quaternion.FromEulerVector(model.root.rotation), model.root.position)
    .equalsWithEpsilon(Matrix.Identity(), 1e-7)) throw new Error('Crea el combate antes de transformar el contenedor exterior.');
  const skeleton = model.container.skeletons[0];
  if (model.container.skeletons.length !== 1 || skeleton?.name !== 'SmartRigArmature' || skeleton.bones.length !== 80) {
    throw new Error('El combate requiere el rig original de Ruen de 80 huesos.');
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
      throw new Error('Canal de locomoción no compatible con el combate.');
    }
    const key = `${target.uniqueId}:${property}`;
    if (seen.has(key)) throw new Error('El Idle equipado contiene canales duplicados.');
    seen.add(key);
    const value = animation.getKeys()[0]?.value;
    if (!(value instanceof Quaternion || value instanceof Vector3) || !value.asArray().every(Number.isFinite)) throw new Error('Pose de combate no válida.');
    channels.push({ target, property: property as Property, value: value.clone() });
  }
  return channels;
}

/**
 * Author on the unchanged import, before scaling or playback. The caller owns
 * all five stopped groups and registers them for reset/disposal. The controller
 * samples attackTime/block age; these clips never trigger damage or root motion.
 */
export function createRuenEquippedCombat(
  model: InspectionModel, scene: Scene, locomotion: RuenEquippedLocomotion,
): RuenEquippedCombat {
  const channels = channelsAndRest(model, scene, locomotion);
  for (const name of Object.values(ruenEquippedCombatProfile.names)) {
    if (scene.animationGroups.some(group => group.name === name)) throw new Error(`La escena ya contiene «${name}».`);
  }
  const nodes = new Map(model.container.transformNodes.map(node => [node.name, node]));
  const base: Pose = new Map(channels.filter(channel => channel.property === 'rotationQuaternion')
    .map(channel => [channel.target, (channel.value as Quaternion).clone()]));
  const authored = (key: KeyPose): Pose => {
    if (key.idle) return new Map([...base].map(([node, value]) => [node, value.clone()]));
    const pose = new PoseBuilder(nodes, base);
    pose.rotateModel('mixamorig:Spine1', Vector3.Up(), (key.yaw ?? 0) * Math.PI / 180);
    pose.rotateModel('mixamorig:Spine2', Vector3.Right(), (key.pitch ?? 0) * Math.PI / 180);
    pose.arm('Right', key.right ?? guardSword); pose.arm('Left', key.left ?? attackShield);
    return pose.rotations;
  };
  const groups: Partial<RuenEquippedCombat> = {};
  try {
    for (const state of Object.keys(ruenEquippedCombatProfile.names) as RuenCombatState[]) {
      const specs = ruenCombatPoseTargets[state];
      const poses = specs.map(spec => ({ time: spec.time, rotations: authored(spec) }));
      const duration = state === 'shield' ? ruenEquippedCombatProfile.guardLoopSeconds : state === 'block' ?
        ruenEquippedCombatProfile.blockSeconds : attacks[Number(state.at(-1)) - 1]!.duration;
      if (state === 'shield') {
        const inhale = new Map([...poses[0]!.rotations].map(([node, value]) => [node, value.clone()]));
        for (const [name, degrees] of [['mixamorig:Spine1', 0.55], ['mixamorig:Spine2', 0.75]] as const) {
          const node = nodes.get(name)!;
          inhale.set(node, inhale.get(node)!.multiply(Quaternion.RotationAxis(Vector3.Right(), degrees * Math.PI / 180)));
        }
        poses.push({ time: duration / 2, rotations: inhale }, { time: duration, rotations: poses[0]!.rotations });
      }
      // Bake eased segments at 60 Hz and retain exact fractional mechanic keys.
      // Sampling never shifts windup/activeEnd to a neighbouring integer frame.
      const times = [...new Set([...poses.map(pose => pose.time), ...Array.from({ length: Math.ceil(duration * 60) + 1 }, (_, index) => Math.min(duration, index / 60))])].sort((a, b) => a - b);
      const group = new AnimationGroup(ruenEquippedCombatProfile.names[state], scene); groups[state] = group;
      for (const channel of channels) {
        const rotation = channel.property === 'rotationQuaternion';
        // The inspector repeats every clip. CONSTANT freezes at the last pose
        // after one lap, including later goToFrame seeks. Gameplay keeps these
        // groups paused and samples its controller clock, so CYCLE only enables
        // preview repetition; an exact endpoint seek still returns the last key.
        const animation = new Animation(`${group.name}:${channel.target.name}:${channel.property}`, channel.property, ruenEquippedCombatProfile.fps,
          rotation ? Animation.ANIMATIONTYPE_QUATERNION : Animation.ANIMATIONTYPE_VECTOR3,
          Animation.ANIMATIONLOOPMODE_CYCLE);
        animation.setKeys(times.map(time => {
          let index = 0; while (index < poses.length - 2 && poses[index + 1]!.time < time) index++;
          const before = poses[index]!, after = poses[Math.min(index + 1, poses.length - 1)]!;
          const t = after.time === before.time ? 0 : Math.min(1, Math.max(0, (time - before.time) / (after.time - before.time)));
          const eased = t * t * (3 - 2 * t);
          const value = rotation ? Quaternion.Slerp(before.rotations.get(channel.target)!, after.rotations.get(channel.target)!, eased).normalize() : channel.value.clone();
          return { frame: time * ruenEquippedCombatProfile.fps, value };
        }));
        group.addTargetedAnimation(animation, channel.target);
      }
      group.from = 0; group.to = duration * ruenEquippedCombatProfile.fps;
    }
    return groups as RuenEquippedCombat;
  } catch (error) {
    for (const group of Object.values(groups)) group?.dispose();
    throw error;
  }
}
