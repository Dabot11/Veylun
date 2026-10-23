import { Animation } from '@babylonjs/core/Animations/animation';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { gameConfig } from '../config/gameConfig';
import type { InspectionModel } from './inspectModel';
import type { RuenEquippedLocomotion } from './ruenEquippedLocomotion';
import { RuenPoseBuilder, collectRuenEquippedChannels } from './ruenPoseAuthoring';

export type RuenTraversalState = 'jump' | 'fall' | 'land' | 'roll';
export type RuenEquippedTraversal = Record<RuenTraversalState, AnimationGroup>;
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
/**
 * Creates four stopped caller-owned clips on the unmodified imported rig.
 * Register them with the model for reset/disposal. The controller supplies the
 * physical jump trajectory and roll direction; these clips move no exterior
 * root and add no lateral translation. Only the internal pelvis articulates.
 */
export function createRuenEquippedTraversal(
  model: InspectionModel, scene: Scene, locomotion: RuenEquippedLocomotion,
): RuenEquippedTraversal {
  const channels = collectRuenEquippedChannels(model, scene, locomotion);
  if (channels.length !== 160) throw new Error('El recorrido requiere los 160 canales locales originales.');
  for (const name of Object.values(ruenEquippedTraversalProfile.names)) {
    if (scene.animationGroups.some(group => group.name === name)) throw new Error(`La escena ya contiene «${name}».`);
  }
  const nodes = new Map(model.container.transformNodes.map(node => [node.name, node]));
  const base = new Map(channels.filter(channel => channel.property === 'rotationQuaternion').map(channel => [channel.target, (channel.value as Quaternion).clone()]));
  const idle = new RuenPoseBuilder(nodes, base);
  const hips = idle.node('mixamorig:Hips'), hipRest = hips.position.clone();
  const feet = new Map((['Left', 'Right'] as const).map(side => [side, idle.position(idle.node(`mixamorig:${side}Foot`))]));
  const mix = (a: RuenPoseBuilder, b: RuenPoseBuilder, weight: number): RuenPoseBuilder => {
    const t = Math.max(0, Math.min(1, weight)), pose = new RuenPoseBuilder(nodes, base);
    if (t === 0) return new RuenPoseBuilder(nodes, a.rotations, a.positions);
    if (t === 1) return new RuenPoseBuilder(nodes, b.rotations, b.positions);
    for (const [node, rotation] of a.rotations) pose.set(node, Quaternion.Slerp(rotation, b.rotations.get(node)!, t));
    for (const node of new Set([...a.positions.keys(), ...b.positions.keys()])) {
      pose.setPosition(node, Vector3.Lerp(a.positions.get(node) ?? node.position, b.positions.get(node) ?? node.position, t));
    }
    return pose;
  };
  const makePose = (drop: number, tuck: number, pitch: number, compact: boolean): RuenPoseBuilder => {
    const pose = new RuenPoseBuilder(nodes, base);
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
  const plantFeet = (pose: RuenPoseBuilder, tuck = 0): RuenPoseBuilder => {
    // Blending bent-leg quaternions alone pulls the sole below its contact
    // plane. Re-solve each sample, retaining its knee plane and foot orientation.
    for (const side of ['Left', 'Right'] as const) {
      pose.leg(side, feet.get(side)!.add(new Vector3(0, tuck, -tuck * 0.25)),
        idle.world(idle.node(`mixamorig:${side}Foot`)), true);
    }
    return pose;
  };
  const poseAt = (state: RuenTraversalState, time: number): RuenPoseBuilder => {
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
