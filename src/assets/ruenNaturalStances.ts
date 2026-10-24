import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { InspectionModel } from './inspectModel';
import type { RuenEquippedLocomotion } from './ruenEquippedLocomotion';
import type { RuenEquippedCombat } from './ruenEquippedCombat';
import { RuenPoseBuilder, collectRuenEquippedChannels } from './ruenPoseAuthoring';

export const ruenNaturalStanceProfile = {
  version: 'posture-v1',
  durationSeconds: 4,
  idleHipOffset: [0.025, -0.018, 0] as const,
  guardHipOffset: [-0.012, -0.065, 0.014] as const,
} as const;

const radians = (degrees: number) => degrees * Math.PI / 180;
const ease = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };

/** Move axial pronation out of the wrist into the forearm, keeping the palm
 * and the weapon in the same world pose. The elbow and wrist positions stay
 * fixed because the twist axis runs along the forearm's own wrist offset. */
function distributeForearmTwist(pose: RuenPoseBuilder, side: 'Left' | 'Right'): void {
  const forearm = pose.node(`mixamorig:${side}ForeArm`), hand = pose.node(`mixamorig:${side}Hand`);
  const handRotation = pose.rotations.get(hand)!;
  const delta = handRotation.multiply(hand.rotationQuaternion!.conjugate()).normalize();
  const axis = hand.position.normalizeToNew();
  const projection = delta.x * axis.x + delta.y * axis.y + delta.z * axis.z;
  const twist = new Quaternion(axis.x * projection, axis.y * projection, axis.z * projection, delta.w);
  if (twist.lengthSquared() < 1e-8) return;
  twist.normalize();
  pose.set(forearm, pose.rotations.get(forearm)!.multiply(twist));
  pose.set(hand, twist.conjugate().multiply(handRotation));
}

/** Refine caller-owned stance clips after other actions have been authored.
 * Carry arm rotations also follow the fitted grips in the eight movement
 * variants; their torso/leg keys remain intact. This avoids rebasing attacks,
 * traversal, or action timing on a new pelvis pose. Imported tracks, the rest rig, group identities and inventory
 * remain unchanged. All keys are prepared before committing either group. */
export function refineRuenStances(
  model: InspectionModel, scene: Scene, locomotion: RuenEquippedLocomotion, combat?: RuenEquippedCombat,
): void {
  const channels = collectRuenEquippedChannels(model, scene, locomotion);
  const groups = [locomotion.idle, ...(combat ? [combat.shield, combat.block] : [])];
  if (groups.some(group => group.isStarted || group.getScene() !== scene)) throw new Error('Refina las posturas antes de reproducirlas.');
  const nodes = new Map(model.container.transformNodes.map(node => [node.name, node]));
  const base = new Map(channels.filter(channel => channel.property === 'rotationQuaternion')
    .map(channel => [channel.target, (channel.value as Quaternion).clone()]));
  const positions = new Map(channels.filter(channel => channel.property === 'position')
    .map(channel => [channel.target, (channel.value as Vector3).clone()]));
  const neutral = new RuenPoseBuilder(nodes, base, positions), hips = neutral.node('mixamorig:Hips');
  const footFrames = new Map((['Left', 'Right'] as const).map(side => [side, neutral.world(neutral.node(`mixamorig:${side}Foot`)).clone()]));

  const makePose = (guard: boolean, time: number, impact = 0): RuenPoseBuilder => {
    const pose = new RuenPoseBuilder(nodes, base, positions);
    const phase = time * 2 * Math.PI / ruenNaturalStanceProfile.durationSeconds;
    const breath = (1 - Math.cos(phase)) * 0.5;
    const settle = Math.sin(phase) * 0.002;
    const offset = Vector3.FromArray(guard ? ruenNaturalStanceProfile.guardHipOffset : ruenNaturalStanceProfile.idleHipOffset);
    offset.x += settle; offset.y += breath * 0.0015; offset.z -= impact * 0.008;
    pose.setPosition(hips, positions.get(hips)!.add(offset));
    pose.rotateModel('mixamorig:Hips', Vector3.Forward(), radians(guard ? -0.5 : -1.2));
    pose.rotateModel('mixamorig:Spine', Vector3.Forward(), radians(guard ? 0.4 : 0.8));
    pose.rotateModel('mixamorig:Spine1', Vector3.Up(), radians(guard ? -5 : -2));
    pose.rotateModel('mixamorig:Spine1', Vector3.Right(), radians(breath * 0.22));
    pose.rotateModel('mixamorig:Spine2', Vector3.Right(), radians((guard ? 5 : -0.5) + breath * 0.45 - impact * 5));
    pose.rotateModel('mixamorig:Head', Vector3.Up(), radians(guard ? 4 : 1.5));
    pose.rotateModel('mixamorig:Head', Vector3.Right(), radians((guard ? -3 : 0.5) - breath * 0.2 + impact));
    for (const side of ['Left', 'Right'] as const) {
      const frame = footFrames.get(side)!;
      pose.leg(side, frame.getTranslation(), frame);
    }
    const lift = breath * 0.002;
    pose.arm('Right', guard ? {
      grip: [0.290757 + settle, 1.152998 + lift, 0.315977 - impact * 0.012],
      blade: [0.153926, 0.974833, -0.161268], face: [0.278971, -0.195472, -0.940194], elbow: [0.267848, 1.046974, 0.009955],
    } : {
      grip: [0.35627 + settle, 0.95671 + lift, 0.21250],
      blade: [0.28960, -0.93366, -0.21073], face: [-0.77590, -0.11847, -0.61963], elbow: [0.14228, 1.06030, -0.01109],
    });
    pose.arm('Left', guard ? {
      grip: [-0.190007 + settle, 1.120013 + lift - impact * 0.012, 0.310044 - impact * 0.060],
      face: [0.265605, 0.345167 + impact * 0.10, 0.900174], up: [0.049907, 0.925999, -0.374213], elbow: [-0.188394, 1.004580, 0.018407],
    } : {
      grip: [-0.294768 + settle, 1.015262 + lift, 0.268822],
      face: [0.022640, -0.212467, 0.976906], up: [-0.059880, 0.958834, 0.277583], elbow: [-0.190434, 1.050174, -0.022944],
    });
    distributeForearmTwist(pose, 'Right'); distributeForearmTwist(pose, 'Left');
    return pose;
  };

  const replacements: { animation: AnimationGroup['targetedAnimations'][number]['animation']; keys: { frame: number; value: Vector3 | Quaternion }[] }[] = [];
  for (const group of groups) {
    const guard = group !== locomotion.idle, block = group === combat?.block;
    const fps = group.targetedAnimations[0]!.animation.framePerSecond;
    const duration = (group.to - group.from) / fps;
    const times = [...new Set([0, duration, ...(block ? [0.07, 0.13] : []),
      ...Array.from({ length: Math.ceil(duration * 60) }, (_, i) => i / 60).filter(t => t < duration)])].sort((a, b) => a - b);
    const poses = times.map(time => {
      const impact = block ? time <= 0.07 ? ease(time / 0.07) : 1 - ease((time - 0.07) / (duration - 0.07)) : 0;
      // The reaction begins and ends at the same guard base, independent of
      // its short event clock. Breathing resumes under the regular guard clock.
      return makePose(guard, block ? 0 : time, impact);
    });
    for (const { target, animation } of group.targetedAnimations) {
      const node = target as TransformNode;
      const keys = poses.map((pose, index) => ({ frame: group.from + times[index]! * fps,
        value: animation.targetProperty === 'rotationQuaternion' ? pose.rotations.get(node)!.clone() :
          animation.targetProperty === 'position' ? (pose.positions.get(node) ?? node.position).clone() : node.scaling.clone(),
      }));
      if (keys.some(key => !key.value.asArray().every(Number.isFinite))) throw new Error('La postura contiene una transformación no válida.');
      replacements.push({ animation, keys });
    }
  }
  const carry = makePose(false, 0);
  const raisedSword = makePose(true, 0);
  // Raise the sword when moving: the low resting blade would scrape the floor
  // during the deeper pelvis drop in lateral runs. Keep the shield relaxed.
  for (const part of ['Arm', 'ForeArm', 'Hand']) {
    const node = carry.node(`mixamorig:Right${part}`);
    carry.set(node, raisedSword.rotations.get(node)!.clone());
  }
  const movement = new Set([locomotion.walk, locomotion.run,
    ...model.container.animationGroups.filter(group => /^Ruen_(Walk|Run)_(Left|Right|Back)_Equipped$/.test(group.name))]);
  for (const group of movement) for (const { target, animation } of group.targetedAnimations) {
    if (animation.targetProperty !== 'rotationQuaternion' || !/^mixamorig:(Left|Right)(Arm|ForeArm|Hand)$/.test(target.name)) continue;
    const value = carry.rotations.get(target as TransformNode)!;
    replacements.push({ animation, keys: [{ frame: group.from, value: value.clone() }, { frame: group.to, value: value.clone() }] });
  }
  for (const { animation, keys } of replacements) animation.setKeys(keys);
}
