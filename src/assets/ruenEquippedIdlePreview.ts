import { Animation } from '@babylonjs/core/Animations/animation';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { InspectionModel } from './inspectModel';
import { ruenIdlePreviewProfile } from './ruenIdlePreview';

/** Initial fitting parameters for the isolated equipment preview, not gameplay. */
export const ruenEquippedIdleProfile = {
  name: 'Ruen_Idle_Armed_v1',
  durationSeconds: 4,
  fps: 30,
  // Coordinates beneath the exterior model root, AFTER glTF's conversion node.
  // Aim the left forearm forward; keep both upper arms in their imported pose.
  leftWristTarget: [-0.27, 1.10, 0.24],
  handLocalYawDegrees: { Left: 0, Right: 0 },
  fingerCurlDegrees: {
    Index: [35, 55, 40],
    Middle: [40, 60, 45],
    Ring: [40, 60, 45],
    Pinky: [40, 55, 40],
  },
  // The thumb closes from the opposite side of the grip. Its first joint also
  // turns slightly toward the other fingers around the hand's longitudinal axis.
  thumbCurlDegrees: [12, 20, 15],
  thumbOppositionDegrees: 10,
} as const;

const sides = ['Left', 'Right'] as const;
const fingers = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'] as const;
type Side = typeof sides[number];
interface PoseTrack { node: TransformNode; rotation: Quaternion }

function validRotation(node: TransformNode): Quaternion {
  const value = node.rotationQuaternion;
  if (!value || !value.asArray().every(Number.isFinite) || Math.abs(value.lengthSquared() - 1) > 0.001) {
    throw new Error(`Rotación base no válida en «${node.name}».`);
  }
  return value.clone();
}

function invert(matrix: Matrix, name: string): Matrix {
  if (!Number.isFinite(matrix.determinant()) || Math.abs(matrix.determinant()) < 1e-10) {
    throw new Error(`Transformación no invertible en «${name}».`);
  }
  return Matrix.Invert(matrix);
}

/** Shortest parent-space swing; no decomposition of the mirrored glTF root. */
function aimForearm(forearm: TransformNode, hand: TransformNode, targetWorld: Vector3): Quaternion {
  const parent = forearm.parent as TransformNode;
  const parentInverse = invert(parent.computeWorldMatrix(true), parent.name);
  const toTarget = targetWorld.subtract(forearm.getAbsolutePosition());
  const direction = Vector3.TransformNormal(toTarget, parentInverse);
  const rest = validRotation(forearm);
  const from = Vector3.TransformNormal(hand.position, Matrix.Compose(forearm.scaling, rest, Vector3.Zero()));
  if (from.lengthSquared() < 1e-10 || direction.lengthSquared() < 1e-10) {
    throw new Error('No se puede orientar el antebrazo hacia el punto de agarre.');
  }
  const delta = Quaternion.FromUnitVectorsToRef(from.normalize(), direction.normalize(), Quaternion.Identity());
  return delta.multiply(rest);
}

function gripTracks(side: Side, nodes: Map<string, TransformNode>): PoseTrack[] {
  const get = (suffix: string) => nodes.get(`mixamorig:${side}${suffix}`)!;
  const hand = get('Hand');
  const handInverse = invert(hand.computeWorldMatrix(true), hand.name);
  // Finger frames differ substantially in the original rig. Derive one hinge
  // axis across the palm, then express it in EACH joint's own rest frame.
  // Work in hand space: the common mirrored ancestor cancels in jointToHand.
  const palmAxis = get('HandPinky1').position.subtract(get('HandIndex1').position);
  if (palmAxis.lengthSquared() < 1e-10) throw new Error(`La palma ${side} no define un eje de agarre.`);
  palmAxis.normalize();
  const sign = side === 'Left' ? 1 : -1;
  const tracks: PoseTrack[] = [];
  for (const finger of fingers) for (let index = 0; index < 3; index++) {
    const node = get(`Hand${finger}${index + 1}`);
    const jointToHand = node.computeWorldMatrix(true).multiply(handInverse);
    const handToJoint = invert(jointToHand, node.name);
    const localAxis = Vector3.TransformNormal(palmAxis, handToJoint).normalize();
    const degrees = finger === 'Thumb' ? ruenEquippedIdleProfile.thumbCurlDegrees[index]! :
      ruenEquippedIdleProfile.fingerCurlDegrees[finger][index]!;
    const angle = degrees * Math.PI / 180 * sign * (finger === 'Thumb' ? -1 : 1);
    let rotation = validRotation(node).multiply(Quaternion.RotationAxis(localAxis, angle));
    if (finger === 'Thumb' && index === 0) {
      const oppositionAxis = Vector3.TransformNormal(Vector3.Up(), handToJoint).normalize();
      rotation = rotation.multiply(Quaternion.RotationAxis(oppositionAxis,
        ruenEquippedIdleProfile.thumbOppositionDegrees * Math.PI / 180 * sign));
    }
    tracks.push({ node, rotation });
  }
  return tracks;
}

/**
 * Creates a stopped, caller-owned group. Call immediately after import alongside
 * the neutral preview. The group owns all altered pose channels, so the existing
 * SingleClipPlayer reset restores arms and fingers before another clip starts.
 * No node pose, bind matrix, source animation or container inventory is changed.
 */
export function createRuenEquippedIdlePreview(
  model: InspectionModel, scene: Scene, neutralIdle: AnimationGroup,
): AnimationGroup {
  const name = ruenEquippedIdleProfile.name;
  if (scene.isDisposed || model.root.isDisposed() || model.root.getScene() !== scene || neutralIdle.getScene() !== scene) {
    throw new Error('La escena de la pose equipada no está disponible.');
  }
  if (neutralIdle.isStarted || model.container.animationGroups.some(group => group.isStarted)) {
    throw new Error('Crea la pose equipada antes de reproducir cualquier clip.');
  }
  if (scene.animationGroups.some(group => group.name === name) || model.container.animationGroups.some(group => group.name === name)) {
    throw new Error(`El modelo ya contiene un clip «${name}»; se conserva el original.`);
  }
  const skeleton = model.container.skeletons[0];
  if (model.container.skeletons.length !== 1 || !skeleton || skeleton.name !== 'SmartRigArmature' ||
    skeleton.bones.length !== 80 || new Set(skeleton.bones.map(bone => bone.name)).size !== 80) {
    throw new Error('La pose equipada requiere el rig original SmartRigArmature de 80 huesos únicos.');
  }
  const links: [string, string][] = [['mixamorig:Spine1', 'mixamorig:Spine'], ['mixamorig:Spine2', 'mixamorig:Spine1']];
  for (const side of sides) {
    links.push([`mixamorig:${side}Shoulder`, 'mixamorig:Spine2'],
      [`mixamorig:${side}Arm`, `mixamorig:${side}Shoulder`],
      [`mixamorig:${side}ForeArm`, `mixamorig:${side}Arm`],
      [`mixamorig:${side}Hand`, `mixamorig:${side}ForeArm`]);
    for (const finger of fingers) for (let part = 1; part <= 4; part++) {
      links.push([`mixamorig:${side}Hand${finger}${part}`, `mixamorig:${side}Hand${part === 1 ? '' : `${finger}${part - 1}`}`]);
    }
  }
  const nodes = new Map<string, TransformNode>();
  for (const nodeName of new Set(links.flatMap(([child, parent]) => [child, parent]))) {
    const matches = model.container.transformNodes.filter(node => node.name === nodeName);
    const node = matches[0];
    if (matches.length !== 1 || !node || node.isDisposed() || !node.isDescendantOf(model.root)) {
      throw new Error(`La pose equipada requiere un nodo único del modelo «${nodeName}».`);
    }
    validRotation(node);
    if (![...node.position.asArray(), ...node.scaling.asArray()].every(Number.isFinite)) {
      throw new Error(`Transformación base no válida en «${nodeName}».`);
    }
    nodes.set(nodeName, node);
  }
  for (const [child, parent] of links) {
    const node = nodes.get(child)!;
    if (node.parent !== nodes.get(parent) || skeleton.bones.find(bone => bone.name === child)?.getTransformNode() !== node) {
      throw new Error(`La jerarquía de la pose equipada no coincide en «${child}».`);
    }
  }
  const neutralTargets = new Set<string>();
  for (const { target, animation } of neutralIdle.targetedAnimations) {
    if (!['mixamorig:Spine1', 'mixamorig:Spine2'].includes(target.name) || nodes.get(target.name) !== target ||
      animation.targetProperty !== 'rotationQuaternion' || animation.dataType !== Animation.ANIMATIONTYPE_QUATERNION ||
      animation.framePerSecond !== ruenEquippedIdleProfile.fps) {
      throw new Error('El Idle neutro no es compatible con esta pose equipada.');
    }
    neutralTargets.add(target.name);
  }
  const lastFrame = ruenEquippedIdleProfile.durationSeconds * ruenEquippedIdleProfile.fps;
  if (neutralIdle.name !== ruenIdlePreviewProfile.name || neutralIdle.targetedAnimations.length !== 2 || neutralTargets.size !== 2 ||
    neutralIdle.from !== 0 || neutralIdle.to !== lastFrame) {
    throw new Error('La pose equipada requiere el Idle neutro original de cuatro segundos.');
  }

  model.root.computeWorldMatrix(true);
  for (const node of nodes.values()) node.computeWorldMatrix(true);
  const targetWorld = Vector3.TransformCoordinates(Vector3.FromArray(ruenEquippedIdleProfile.leftWristTarget), model.root.getWorldMatrix());
  const poses: PoseTrack[] = [];
  for (const side of sides) {
    for (const part of ['Arm', 'ForeArm', 'Hand']) {
      const node = nodes.get(`mixamorig:${side}${part}`)!;
      let rotation = validRotation(node);
      if (side === 'Left' && part === 'ForeArm') {
        rotation = aimForearm(node, nodes.get('mixamorig:LeftHand')!, targetWorld);
      } else if (part === 'Hand') {
        rotation = rotation.multiply(Quaternion.RotationAxis(Vector3.Up(), ruenEquippedIdleProfile.handLocalYawDegrees[side] * Math.PI / 180));
      }
      poses.push({ node, rotation });
    }
    poses.push(...gripTracks(side, nodes));
  }

  const group = new AnimationGroup(name, scene);
  try {
    for (const { target, animation } of neutralIdle.targetedAnimations) {
      const copy = animation.clone(true); copy.name = `${name}:${target.name}`;
      group.addTargetedAnimation(copy, target);
    }
    for (const { node, rotation } of poses) {
      const animation = new Animation(`${name}:${node.name}`, 'rotationQuaternion', ruenEquippedIdleProfile.fps,
        Animation.ANIMATIONTYPE_QUATERNION, Animation.ANIMATIONLOOPMODE_CYCLE);
      animation.setKeys([{ frame: 0, value: rotation.clone() }, { frame: lastFrame, value: rotation.clone() }]);
      group.addTargetedAnimation(animation, node);
    }
    return group;
  } catch (error) {
    group.dispose();
    throw error;
  }
}
