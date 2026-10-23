import { Animation } from '@babylonjs/core/Animations/animation';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { guardianCombat } from '../enemies/guardianCombat';
import type { InspectionModel } from './inspectModel';
import type { RuenEquippedLocomotion } from './ruenEquippedLocomotion';
import { RuenPoseBuilder, collectRuenEquippedChannels, type RuenArmTarget } from './ruenPoseAuthoring';

export type RuenActionState = 'hurt' | 'death' | 'interact' | 'victory';
export type RuenEquippedActions = Record<RuenActionState, AnimationGroup>;
type Triple = readonly [number, number, number];
interface ActionPose {
  time: number;
  idle?: true;
  drop?: number;
  roll?: number;
  pitch?: number;
  yaw?: number;
  headPitch?: number;
  right?: RuenArmTarget;
  left?: RuenArmTarget;
  leftFoot?: Triple;
  rightFoot?: Triple;
}

export const ruenEquippedActionsProfile = {
  fps: 60,
  duration: { hurt: 0.3, death: 1.25, interact: 0.5, victory: guardianCombat.restorationDuration },
  names: { hurt: 'Ruen_Hurt_Equipped', death: 'Ruen_Death_Equipped', interact: 'Ruen_Interact_Equipped', victory: 'Ruen_Victory_Equipped' },
  holdFrom: { death: 1.05, victory: 2.55 },
  hurtPeak: 0.075,
} as const;
const idle = (time: number): ActionPose => ({ time, idle: true });
const smooth = (value: number): number => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const sword = (grip: Triple, blade: Triple = [0.28, -0.63, 0.72]): RuenArmTarget => ({ grip, blade, face: [0, 0.3, 1] });
const shield = (grip: Triple): RuenArmTarget => ({ grip, face: [-0.1, 0.05, 1] });
const resting: Omit<ActionPose, 'time'> = {
  drop: 0.69, roll: -86, pitch: 22, headPitch: 14,
  leftFoot: [-0.58, 0.16, 0.18], rightFoot: [-0.45, 0.17, -0.18],
  right: { grip: [0.32, 0.16, 0.42], blade: [0.1, 0.03, 1], face: [0, 1, 0], elbow: [0.30, 0.15, 0.16] },
  left: { grip: [0.28, 0.44, -0.10], face: [0, 1, 0], up: [0, 0, 1], elbow: [0.10, 0.4, -0.20] },
};
const celebrated: Omit<ActionPose, 'time'> = {
  pitch: -3, yaw: -3, headPitch: -8,
  right: sword([0.32, 1.55, 0.12], [0.15, 0.98, 0.07]), left: shield([-0.30, 1.20, 0.16]),
};

// Surface support for the sideways death, measured from the unchanged master
// SHA-256 d662ef7c34a346379d15f6eb31069a60f35b2dd161911ed5d6df98232ad5db35.
// Cape vertices 58443/55045 and opposite edge 44548 are rigid in Spine2 space:
// their original influences are unchanged cape descendants. Boot vertex 67290
// needs both inverse-bind-local points, because its toe and foot bend separately.
// These action-only probes complement the shared joint/gear support; they do
// not change traversal support, bone lengths, equipment mounts or root motion.
const deathCapeSupport = [
  new Vector3(-0.30690490203155596, -0.6298538227592563, -0.08296339975258082),
  new Vector3(-0.30658488355430175, -0.590558622680257, -0.07133083175055357),
  new Vector3(0.2990387193467266, -0.589944519179037, -0.07077969957450755),
];
function deathSurfaceHeight(pose: RuenPoseBuilder): number {
  const spine = pose.world(pose.node('mixamorig:Spine2'));
  const boot = Vector3.TransformCoordinates(new Vector3(0.03025425492751639, 0.07348572796265435, -0.050107785773852824), pose.world(pose.node('mixamorig:RightToeBase')))
    .scale(0.6960636377334595).add(Vector3.TransformCoordinates(new Vector3(-0.06769314860768755, 0.19335090361789575, 0.03231850208583803), pose.world(pose.node('mixamorig:RightFoot'))).scale(0.30393633246421814));
  return Math.min(pose.supportHeight(), boot.y, ...deathCapeSupport.map(point => Vector3.TransformCoordinates(point, spine).y));
}

/** Authored gestures; no events, damage, respawn, interaction or win logic. */
export const ruenActionPoseTargets: Readonly<Record<RuenActionState, readonly ActionPose[]>> = {
  hurt: [
    idle(0),
    { time: 0.075, drop: 0.045, pitch: -15, yaw: -9, headPitch: -10,
      right: sword([0.32, 1.06, 0.10]), left: shield([-0.20, 1.16, 0.22]) },
    { time: 0.18, drop: 0.025, pitch: 6, yaw: 3, headPitch: 5,
      right: sword([0.32, 1.02, 0.13]), left: shield([-0.26, 1.12, 0.21]) },
    idle(0.3),
  ],
  death: [
    idle(0),
    { time: 0.10, drop: 0.04, pitch: -12, yaw: -6, headPitch: -8,
      right: sword([0.32, 1.08, 0.14]), left: shield([-0.22, 1.16, 0.21]) },
    { time: 0.38, drop: 0.40, pitch: 25, headPitch: 18,
      right: sword([0.30, 0.78, 0.30], [0.8, -0.1, 0.6]), left: shield([-0.22, 0.82, 0.17]) },
    { time: 0.65, drop: 0.51, roll: -35, pitch: 30, headPitch: 22,
      leftFoot: [-0.18, 0.145, 0.09], rightFoot: [0.10, 0.15, -0.18],
      right: { grip: [0.32, 0.36, 0.35], blade: [0.3, 0.08, 1], face: [0, 1, 0], elbow: [0.38, 0.36, 0.1] },
      left: { grip: [-0.02, 0.75, 0.05], face: [0, 0.7, 1], up: [0.5, 1, -0.7] } },
    { time: 0.95, ...resting, roll: -91, headPitch: 22 },
    { time: ruenEquippedActionsProfile.holdFrom.death, ...resting },
    { time: ruenEquippedActionsProfile.duration.death, ...resting },
  ],
  interact: [
    idle(0),
    { time: 0.12, drop: 0.025, pitch: 5, yaw: -5, headPitch: 8,
      right: sword([0.26, 1.16, 0.20], [0.2, 0.9, 0.38]), left: shield([-0.28, 1.02, 0.12]) },
    { time: 0.25, drop: 0.035, pitch: 8, yaw: -6, headPitch: 10,
      right: sword([0.16, 1.23, 0.39], [0.1, 0.96, 0.25]), left: shield([-0.28, 1.02, 0.12]) },
    { time: 0.34, drop: 0.02, pitch: 3, headPitch: 5,
      right: sword([0.22, 1.20, 0.32], [0.15, 0.97, 0.20]), left: shield([-0.27, 1.07, 0.16]) },
    idle(0.5),
  ],
  victory: [
    idle(0),
    { time: 0.55, drop: 0.05, pitch: 8, headPitch: 8,
      right: sword([0.20, 1.17, 0.33], [-0.1, 0.91, 0.4]), left: shield([-0.20, 1.18, 0.30]) },
    { time: 0.90, drop: 0.05, pitch: 9, headPitch: 10,
      right: sword([0.12, 1.19, 0.40], [0, 0.96, 0.28]), left: shield([-0.22, 1.16, 0.25]) },
    { time: 1.40, pitch: 0, headPitch: -3,
      right: sword([0.28, 1.46, 0.20], [0.15, 0.98, 0.10]), left: shield([-0.29, 1.16, 0.18]) },
    { time: 2.15, pitch: -4, yaw: -3, headPitch: -10,
      right: sword([0.30, 1.58, 0.08], [0.15, 0.98, 0.07]), left: shield([-0.30, 1.20, 0.16]) },
    { time: ruenEquippedActionsProfile.holdFrom.victory, ...celebrated },
    { time: ruenEquippedActionsProfile.duration.victory, ...celebrated },
  ],
};

/** Author before external transforms/playback. Caller registers and disposes all
 * four stopped groups. CYCLE permits inspector repetition; gameplay manually
 * samples/clamps its clock and holds death/victory at their final poses. */
export function createRuenEquippedActions(
  model: InspectionModel, scene: Scene, locomotion: RuenEquippedLocomotion,
): RuenEquippedActions {
  const channels = collectRuenEquippedChannels(model, scene, locomotion);
  if (channels.length !== 160) throw new Error('Las acciones requieren los 160 canales locales originales.');
  for (const name of Object.values(ruenEquippedActionsProfile.names)) {
    if (scene.animationGroups.some(group => group.name === name)) throw new Error(`La escena ya contiene «${name}».`);
  }
  const nodes = new Map(model.container.transformNodes.map(node => [node.name, node]));
  const base = new Map(channels.filter(channel => channel.property === 'rotationQuaternion').map(channel => [channel.target, (channel.value as Quaternion).clone()]));
  const neutral = new RuenPoseBuilder(nodes, base), hips = neutral.node('mixamorig:Hips');
  const feet = new Map((['Left', 'Right'] as const).map(side => [side, neutral.position(neutral.node(`mixamorig:${side}Foot`))]));
  const footTarget = (spec: ActionPose, side: 'Left' | 'Right'): Vector3 => {
    const target = side === 'Left' ? spec.leftFoot : spec.rightFoot;
    return target ? Vector3.FromArray(target) : feet.get(side)!.clone();
  };
  const footFrame = (side: 'Left' | 'Right', roll: number): Matrix => neutral.world(neutral.node(`mixamorig:${side}Foot`)).multiply(Matrix.RotationZ(roll * Math.PI / 180));
  const makePose = (spec: ActionPose): RuenPoseBuilder => {
    const pose = new RuenPoseBuilder(nodes, base);
    if (spec.idle) return pose;
    pose.setPosition(hips, hips.position.add(new Vector3(0, -(spec.drop ?? 0), 0)));
    for (const [name, amount] of [['Spine', 0.5], ['Spine1', 0.3], ['Spine2', 0.2]] as const) {
      pose.rotateModel(`mixamorig:${name}`, Vector3.Right(), (spec.pitch ?? 0) * amount * Math.PI / 180);
    }
    pose.rotateModel('mixamorig:Spine1', Vector3.Up(), (spec.yaw ?? 0) * Math.PI / 180);
    pose.rotateModel('mixamorig:Neck', Vector3.Right(), (spec.headPitch ?? 0) * Math.PI / 180);
    pose.rotateModel('mixamorig:Hips', Vector3.Forward(), (spec.roll ?? 0) * Math.PI / 180);
    for (const side of ['Left', 'Right'] as const) pose.leg(side, footTarget(spec, side), footFrame(side, spec.roll ?? 0));
    if (spec.right) pose.arm('Right', spec.right);
    if (spec.left) pose.arm('Left', spec.left);
    return pose;
  };
  const mix = (a: RuenPoseBuilder, b: RuenPoseBuilder, weight: number): RuenPoseBuilder => {
    if (weight === 0) return new RuenPoseBuilder(nodes, a.rotations, a.positions);
    if (weight === 1) return new RuenPoseBuilder(nodes, b.rotations, b.positions);
    const pose = new RuenPoseBuilder(nodes, base);
    for (const [node, rotation] of a.rotations) pose.set(node, Quaternion.Slerp(rotation, b.rotations.get(node)!, weight));
    for (const node of new Set([...a.positions.keys(), ...b.positions.keys()])) {
      pose.setPosition(node, Vector3.Lerp(a.positions.get(node) ?? node.position, b.positions.get(node) ?? node.position, weight));
    }
    return pose;
  };
  const groups: Partial<RuenEquippedActions> = {};
  try {
    for (const state of Object.keys(ruenEquippedActionsProfile.names) as RuenActionState[]) {
      const specs = ruenActionPoseTargets[state], authored = specs.map(makePose);
      const poseAt = (time: number): RuenPoseBuilder => {
        let index = 0; while (index < specs.length - 2 && specs[index + 1]!.time < time) index++;
        const from = specs[index]!, to = specs[index + 1]!;
        const weight = smooth((time - from.time) / (to.time - from.time));
        const pose = mix(authored[index]!, authored[index + 1]!, weight);
        const roll = (from.roll ?? 0) + ((to.roll ?? 0) - (from.roll ?? 0)) * weight;
        for (const side of ['Left', 'Right'] as const) {
          pose.leg(side, Vector3.Lerp(footTarget(from, side), footTarget(to, side), weight), footFrame(side, roll), true);
        }
        if (state === 'death' && time > 0.38) {
          const position = (pose.positions.get(hips) ?? hips.position).clone();
          position.y += Math.max(0, 0.015 - deathSurfaceHeight(pose)) * smooth((time - 0.38) / 0.12);
          pose.setPosition(hips, position);
        }
        return pose;
      };
      const duration = ruenEquippedActionsProfile.duration[state], rate = state === 'victory' ? 60 : 120;
      const times = [...new Set([0, duration, ...specs.map(spec => spec.time), ...Array.from({ length: Math.ceil(duration * rate) }, (_, index) => Math.min(duration, index / rate))])].sort((a, b) => a - b);
      const poses = times.map(poseAt);
      for (let index = 0; index < times.length - 1;) {
        const from = times[index]!, to = times[index + 1]!, middle = (from + to) / 2;
        const contact = state !== 'death' || to <= 0.38;
        const interpolated = contact ? mix(poses[index]!, poses[index + 1]!, 0.5) : undefined;
        const drift = interpolated && (['Left', 'Right'] as const).some(side =>
          Vector3.Distance(interpolated.position(interpolated.node(`mixamorig:${side}Foot`)), feet.get(side)!) > 0.0005);
        if (drift && to - from > 1 / 15360) {
          times.splice(index + 1, 0, middle); poses.splice(index + 1, 0, poseAt(middle));
        } else index++;
      }
      const group = new AnimationGroup(ruenEquippedActionsProfile.names[state], scene); groups[state] = group;
      for (const channel of channels) {
        const rotation = channel.property === 'rotationQuaternion';
        const animation = new Animation(`${group.name}:${channel.target.name}:${channel.property}`, channel.property, ruenEquippedActionsProfile.fps,
          rotation ? Animation.ANIMATIONTYPE_QUATERNION : Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CYCLE);
        animation.setKeys(times.map((time, index) => ({ frame: time * ruenEquippedActionsProfile.fps,
          value: rotation ? poses[index]!.rotations.get(channel.target)!.clone() :
            channel.property === 'position' ? (poses[index]!.positions.get(channel.target) ?? channel.value).clone() : channel.value.clone(),
        })));
        group.addTargetedAnimation(animation, channel.target);
      }
      group.from = 0; group.to = duration * ruenEquippedActionsProfile.fps;
    }
    return groups as RuenEquippedActions;
  } catch (error) {
    for (const group of Object.values(groups)) group?.dispose();
    throw error;
  }
}
