import { Animation } from '@babylonjs/core/Animations/animation';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Quaternion } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { InspectionModel } from './inspectModel';
import type { RuenEquippedLocomotion } from './ruenEquippedLocomotion';
import { RuenPoseBuilder, collectRuenEquippedChannels } from './ruenPoseAuthoring';
import { ruenEquipmentProfiles } from './ruenEquipmentProfile';

export type RuenDirectionalState = 'walkLeft' | 'walkRight' | 'walkBack' | 'runLeft' | 'runRight' | 'runBack';
export type RuenEquippedDirectional = Record<RuenDirectionalState, AnimationGroup>;

export const ruenEquippedDirectionalProfile = {
  fps: 60,
  duration: { walk: 0.8, run: 0.36 },
  referenceSpeed: { walk: 1.2, run: 4 },
  names: {
    walkLeft: 'Ruen_Walk_Left_Equipped', walkRight: 'Ruen_Walk_Right_Equipped', walkBack: 'Ruen_Walk_Back_Equipped',
    runLeft: 'Ruen_Run_Left_Equipped', runRight: 'Ruen_Run_Right_Equipped', runBack: 'Ruen_Run_Back_Equipped',
  },
} as const;

/**
 * Six in-place cycles with a forward-facing chest and separately solved legs.
 * Left/right steps travel across the body instead of turning the forward walk
 * ninety degrees. At running speed the trailing foot crosses behind the lead
 * foot in a separate fore/aft lane. Backward strides retain forward-facing feet.
 * The caller advances the normalized phase from actual controller displacement.
 */
export function createRuenEquippedDirectional(
  model: InspectionModel, scene: Scene, locomotion: RuenEquippedLocomotion,
): RuenEquippedDirectional {
  const channels = collectRuenEquippedChannels(model, scene, locomotion);
  if (channels.length !== 160) throw new Error('La locomoción direccional requiere los 160 canales originales.');
  for (const name of Object.values(ruenEquippedDirectionalProfile.names)) {
    if (scene.animationGroups.some(group => group.name === name)) throw new Error(`La escena ya contiene «${name}».`);
  }
  const nodes = new Map(model.container.transformNodes.map(node => [node.name, node]));
  const rotations = new Map<TransformNode, Quaternion>(channels.filter(channel => channel.property === 'rotationQuaternion')
    .map(channel => [channel.target, (channel.value as Quaternion).clone()]));
  const positions = new Map<TransformNode, Vector3>(channels.filter(channel => channel.property === 'position')
    .map(channel => [channel.target, (channel.value as Vector3).clone()]));
  const idle = new RuenPoseBuilder(nodes, rotations, positions);
  const hips = idle.node('mixamorig:Hips'), hipsBase = positions.get(hips)!.clone();
  const sides = ['Left', 'Right'] as const;
  const feet = new Map(sides.map(side => {
    const node = idle.node(`mixamorig:${side}Foot`);
    const upper = idle.position(idle.node(`mixamorig:${side}UpLeg`)), knee = idle.position(idle.node(`mixamorig:${side}Leg`));
    return [side, { position: idle.position(node), orientation: idle.world(node).clone(),
      reach: Vector3.Distance(upper, knee) + Vector3.Distance(knee, idle.position(node)) }];
  }));
  const weapon = (kind: 'sword' | 'shield') => {
    const profile = ruenEquipmentProfiles.find(item => item.kind === kind)!;
    const grip = Vector3.FromArray(profile.grip), origin = idle.weaponPoint(kind, grip);
    return { origin,
      blade: idle.weaponPoint(kind, grip.add(new Vector3(0, -1, 0))).subtract(origin).normalize(),
      face: idle.weaponPoint(kind, grip.add(Vector3.Forward())).subtract(origin).normalize(),
    };
  };
  const sword = weapon('sword'), shield = weapon('shield');
  const triple = (v: Vector3): [number, number, number] => [v.x, v.y, v.z];
  const poseAt = (state: RuenDirectionalState, phase: number): RuenPoseBuilder => {
    // Use an exact common endpoint, including floating-point trigonometry.
    const cycle = phase === 1 ? 0 : phase;
    const running = state.startsWith('run'), backward = state.endsWith('Back');
    const direction = state.endsWith('Left') ? -1 : 1;
    const pose = new RuenPoseBuilder(nodes, rotations, positions);
    const bob = (running ? 0.035 : 0.012) * Math.sin(cycle * Math.PI * 2) ** 2;
    const drop = (running ? 0.23 : 0.10) - bob;
    pose.setPosition(hips, hipsBase.add(new Vector3(0, -drop, 0)));
    // Small counterbalancing lean; the chest and face retain their forward yaw.
    pose.rotateModel('mixamorig:Spine', Vector3.Right(), backward ? -0.045 : running ? 0.035 : 0.015);
    pose.rotateModel('mixamorig:Spine1', Vector3.Forward(), backward ? 0 : -direction * (running ? 0.025 : 0.015));
    const targets = new Map<typeof sides[number], Vector3>();
    let additionalDrop = 0;
    for (const side of sides) {
      const base = feet.get(side)!, sign = side === 'Left' ? -1 : 1;
      const footPhase = (cycle + (side === 'Right' ? 0.5 : 0)) % 1;
      const swing = (footPhase - 0.5) * 2;
      // A planted foot travels opposite the controller at constant speed.
      // The cubic return matches that velocity at both contact boundaries.
      const stride = footPhase <= 0.5 ? 1 - 4 * footPhase : -1 - 2 * swing + 12 * swing ** 2 - 8 * swing ** 3;
      const lift = footPhase <= 0.5 ? 0 : Math.sin(swing * Math.PI) ** 2 * (running ? 0.18 : 0.085);
      const gait = running ? 'run' : 'walk';
      // Convert controller units to the model's authored 1.70 m space. Half
      // the cycle is support, with two amplitudes of travel during that half.
      const amplitude = ruenEquippedDirectionalProfile.referenceSpeed[gait] * ruenEquippedDirectionalProfile.duration[gait] * 0.5 / (2 * (1.45 / 1.70));
      // Side runs use a modest crossover behind/in front, avoiding intersecting
      // boots. The walk opens its stance enough to remain a side step.
      const lane = backward ? 0 : sign * direction * (running ? 0.19 : 0.10);
      const target = base.position.add(new Vector3(
        sign * (running ? -0.015 : 0.025) + (backward ? 0 : direction * amplitude * stride),
        lift + 0.009,
        lane + (backward ? -amplitude * stride : 0),
      ));
      targets.set(side, target);
      // A longer step lowers the pelvis just enough to stay inside the fixed
      // leg reach. Otherwise IK clamping would shorten the planted-foot path
      // and lose both the calibrated support speed and the sole contact.
      const upper = pose.position(pose.node(`mixamorig:${side}UpLeg`));
      const horizontal = (upper.x - target.x) ** 2 + (upper.z - target.z) ** 2;
      const supportedHeight = Math.sqrt(Math.max(0, (base.reach - 0.0001) ** 2 - horizontal));
      additionalDrop = Math.max(additionalDrop, upper.y - target.y - supportedHeight);
    }
    if (additionalDrop > 0) pose.setPosition(hips, hipsBase.add(new Vector3(0, -drop - additionalDrop, 0)));
    for (const side of sides) pose.leg(side, targets.get(side)!, feet.get(side)!.orientation);
    // Keep the hands at the established equipped grips while the pelvis sinks
    // for each step, rather than dragging the sword tip through the floor.
    pose.arm('Right', { grip: triple(sword.origin.add(new Vector3(0, bob * 0.2 + (running ? 0.025 : 0), 0))),
      blade: triple(sword.blade), face: triple(sword.face) });
    pose.arm('Left', { grip: triple(shield.origin.add(new Vector3(0, bob * 0.2, 0))), face: triple(shield.face) });
    return pose;
  };
  const created: Partial<RuenEquippedDirectional> = {};
  try {
    for (const state of Object.keys(ruenEquippedDirectionalProfile.names) as RuenDirectionalState[]) {
      const duration = ruenEquippedDirectionalProfile.duration[state.startsWith('run') ? 'run' : 'walk'];
      // Dense IK keys keep sole contact between keys as well as at the keys.
      const count = Math.round(duration * 240);
      const poses = Array.from({ length: count + 1 }, (_, index) => poseAt(state, index / count));
      const group = new AnimationGroup(ruenEquippedDirectionalProfile.names[state], scene); created[state] = group;
      for (const channel of channels) {
        const rotation = channel.property === 'rotationQuaternion';
        const animation = new Animation(`${group.name}:${channel.target.name}:${channel.property}`, channel.property,
          ruenEquippedDirectionalProfile.fps, rotation ? Animation.ANIMATIONTYPE_QUATERNION : Animation.ANIMATIONTYPE_VECTOR3,
          Animation.ANIMATIONLOOPMODE_CYCLE);
        animation.setKeys(poses.map((pose, index) => ({ frame: index / count * duration * ruenEquippedDirectionalProfile.fps,
          value: rotation ? pose.rotations.get(channel.target)!.clone() : channel.property === 'position' ?
            (pose.positions.get(channel.target) ?? channel.value).clone() : channel.value.clone(),
        })));
        group.addTargetedAnimation(animation, channel.target);
      }
      group.from = 0; group.to = duration * ruenEquippedDirectionalProfile.fps;
    }
    return created as RuenEquippedDirectional;
  } catch (error) {
    for (const group of Object.values(created)) group?.dispose();
    throw error;
  }
}
