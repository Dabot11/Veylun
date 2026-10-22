import { Animation } from '@babylonjs/core/Animations/animation';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { EasingFunction, SineEase } from '@babylonjs/core/Animations/easing';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { InspectionModel } from './inspectModel';

/** Authored preview parameters, not metadata or an animation from the master GLB. */
export const ruenIdlePreviewProfile = {
  name: 'Ruen_Idle_v1',
  durationSeconds: 4,
  fps: 30,
  description: 'Prototipo de respiración suave sobre la pose base; pelvis y pies inmóviles.',
  // Small local pitch offsets. Their combined maximum is 1.3 degrees; no chest
  // scaling, vertical root motion, or independent cape motion is introduced.
  rotations: [
    { bone: 'mixamorig:Spine1', axis: 'local-X', maxDegrees: 0.55 },
    { bone: 'mixamorig:Spine2', axis: 'local-X', maxDegrees: 0.75 },
  ],
} as const;

const expectedParents = [
  ['mixamorig:Hips', 'target_character'],
  ['mixamorig:Spine', 'mixamorig:Hips'],
  ['mixamorig:Spine1', 'mixamorig:Spine'],
  ['mixamorig:Spine2', 'mixamorig:Spine1'],
  ['mixamorig:Neck', 'mixamorig:Spine2'],
  ['mixamorig:Head', 'mixamorig:Neck'],
  ['mixamorig:LeftUpLeg', 'mixamorig:Hips'],
  ['mixamorig:LeftLeg', 'mixamorig:LeftUpLeg'],
  ['mixamorig:LeftFoot', 'mixamorig:LeftLeg'],
  ['mixamorig:LeftToeBase', 'mixamorig:LeftFoot'],
  ['mixamorig:LeftToe_End', 'mixamorig:LeftToeBase'],
  ['mixamorig:RightUpLeg', 'mixamorig:Hips'],
  ['mixamorig:RightLeg', 'mixamorig:RightUpLeg'],
  ['mixamorig:RightFoot', 'mixamorig:RightLeg'],
  ['mixamorig:RightToeBase', 'mixamorig:RightFoot'],
  ['mixamorig:RightToe_End', 'mixamorig:RightToeBase'],
] as const;

/**
 * Call immediately after import, before selecting any source clip. The caller
 * owns the returned stopped group and may attach it to its preview player.
 * Neither the container's groups nor its original inspection report is changed.
 */
export function createRuenIdlePreview(model: InspectionModel, scene: Scene): AnimationGroup {
  if (scene.isDisposed || model.root.isDisposed() || model.root.getScene() !== scene) {
    throw new Error('La escena del prototipo Idle no está disponible.');
  }
  if (model.container.animationGroups.some(group => group.isStarted)) {
    throw new Error('Crea el prototipo Idle antes de reproducir cualquier clip original.');
  }
  if (model.container.animationGroups.some(group => group.name === ruenIdlePreviewProfile.name)) {
    throw new Error(`El modelo ya contiene un clip «${ruenIdlePreviewProfile.name}»; se conserva el original.`);
  }
  const skeleton = model.container.skeletons[0];
  if (model.container.skeletons.length !== 1 || !skeleton || skeleton.name !== 'SmartRigArmature' ||
    skeleton.bones.length !== 80 || new Set(skeleton.bones.map(bone => bone.name)).size !== 80) {
    throw new Error('El prototipo Idle requiere el rig original SmartRigArmature de 80 huesos únicos.');
  }
  const nodes = new Map<string, TransformNode>();
  const requiredNames = new Set(expectedParents.flatMap(([child, parent]) => [child, parent]));
  for (const name of requiredNames) {
    const matches = model.container.transformNodes.filter(node => node.name === name);
    if (matches.length !== 1) throw new Error(`El prototipo Idle requiere un nodo único «${name}».`);
    nodes.set(name, matches[0]!);
  }
  for (const [child, parent] of expectedParents) {
    const node = nodes.get(child)!;
    const bone = skeleton.bones.find(item => item.name === child);
    if (node.parent !== nodes.get(parent) || !bone || bone.getTransformNode() !== node) {
      throw new Error(`La jerarquía del rig no coincide en «${child}».`);
    }
  }

  // Validate everything before allocating the group, so a rejected rig leaves
  // no partially created animation or changes to the imported transforms.
  const tracks = ruenIdlePreviewProfile.rotations.map(config => {
    const node = nodes.get(config.bone)!;
    const rest = node.rotationQuaternion;
    if (!rest || !rest.asArray().every(Number.isFinite) || Math.abs(rest.lengthSquared() - 1) > 0.001) {
      throw new Error(`La rotación base de «${config.bone}» no es válida.`);
    }
    return { config, node, rest: rest.clone() };
  });

  const group = new AnimationGroup(ruenIdlePreviewProfile.name, scene);
  const lastFrame = ruenIdlePreviewProfile.durationSeconds * ruenIdlePreviewProfile.fps;
  for (const { config, node, rest } of tracks) {
    const animation = new Animation(
      `${ruenIdlePreviewProfile.name}:${config.bone}`, 'rotationQuaternion', ruenIdlePreviewProfile.fps,
      Animation.ANIMATIONTYPE_QUATERNION, Animation.ANIMATIONLOOPMODE_CYCLE,
    );
    // Sine ease-in/out on each half-cycle gives zero angular velocity at rest,
    // peak inhalation and the loop seam. Quaternion multiplication composes an
    // offset with the imported local orientation without editing bind matrices.
    const easing = new SineEase(); easing.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
    animation.setEasingFunction(easing);
    animation.setKeys([
      { frame: 0, value: rest.clone() },
      { frame: lastFrame / 2, value: rest.multiply(Quaternion.RotationAxis(Vector3.Right(), config.maxDegrees * Math.PI / 180)) },
      { frame: lastFrame, value: rest.clone() },
    ]);
    group.addTargetedAnimation(animation, node);
  }
  return group;
}
