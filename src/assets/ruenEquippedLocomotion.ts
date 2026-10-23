import { Animation } from '@babylonjs/core/Animations/animation';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { InspectionModel } from './inspectModel';
import { createRuenIdlePreview, ruenIdlePreviewProfile } from './ruenIdlePreview';
import { createRuenEquippedIdlePreview } from './ruenEquippedIdlePreview';

export interface RuenEquippedLocomotion {
  idle: AnimationGroup;
  walk: AnimationGroup;
  run: AnimationGroup;
}

type Property = 'position' | 'rotationQuaternion' | 'scaling';
type Value = Vector3 | Quaternion;
interface Channel { target: TransformNode; property: Property; rest: Value }

export const ruenEquippedLocomotionNames = {
  idle: 'Ruen_Idle_Equipped', walk: 'Ruen_Walk_Equipped', run: 'Ruen_Run_Equipped',
} as const;
export const ruenUnarmedLocomotionNames = {
  idle: 'Ruen_Idle_Unarmed', walk: 'Ruen_Walk_Unarmed', run: 'Ruen_Run_Unarmed',
} as const;

const isGripRotation = (target: TransformNode, property: string): boolean =>
  property === 'rotationQuaternion' && /^mixamorig:(Left|Right)(Arm|ForeArm|Hand|Hand(Thumb|Index|Middle|Ring|Pinky)[1-3])$/.test(target.name);

function sourceGroup(model: InspectionModel, name: string): AnimationGroup {
  const matches = model.container.animationGroups.filter(group => group.name === name);
  const group = matches[0];
  if (matches.length !== 1 || !group || group.to <= group.from || !group.targetedAnimations.length) {
    throw new Error(`La locomoción de Ruen requiere un clip original válido y único «${name}».`);
  }
  const fps = group.targetedAnimations[0]!.animation.framePerSecond;
  if (!Number.isFinite(fps) || fps <= 0 || group.targetedAnimations.some(track => track.animation.framePerSecond !== fps)) {
    throw new Error(`El clip «${name}» no tiene una frecuencia uniforme válida.`);
  }
  return group;
}

function collectChannels(groups: AnimationGroup[], model: InspectionModel): Channel[] {
  const channels: Channel[] = [];
  const seen = new Map<TransformNode, Set<string>>();
  for (const group of groups) {
    const withinGroup = new Map<TransformNode, Set<string>>();
    for (const { target, animation } of group.targetedAnimations) {
      const property = animation.targetProperty;
      if (!(target instanceof TransformNode) || !model.container.transformNodes.includes(target) ||
        !['position', 'rotationQuaternion', 'scaling'].includes(property)) {
        throw new Error('La locomoción sólo admite canales locales del rig original.');
      }
      const local = withinGroup.get(target) ?? new Set<string>();
      if (local.has(property)) throw new Error(`Canal duplicado en «${group.name}»: ${target.name}.${property}.`);
      local.add(property); withinGroup.set(target, local);
      const properties = seen.get(target) ?? new Set<string>();
      if (properties.has(property)) continue;
      properties.add(property); seen.set(target, properties);
      const typedProperty = property as Property;
      const rest = target[typedProperty];
      if (!(rest instanceof Vector3 || rest instanceof Quaternion) || !rest.asArray().every(Number.isFinite)) {
        throw new Error(`Canal base no válido en «${target.name}.${property}».`);
      }
      const expectedType = rest instanceof Quaternion ? Animation.ANIMATIONTYPE_QUATERNION : Animation.ANIMATIONTYPE_VECTOR3;
      if (animation.dataType !== expectedType) throw new Error(`Tipo de animación no compatible en «${target.name}.${property}».`);
      channels.push({ target, property: typedProperty, rest: rest.clone() });
    }
  }
  return channels;
}

function constantTrack(channel: Channel, name: string, from: number, to: number, fps: number, value = channel.rest): Animation {
  const animation = new Animation(`${name}:${channel.target.name}:${channel.property}`, channel.property, fps,
    value instanceof Quaternion ? Animation.ANIMATIONTYPE_QUATERNION : Animation.ANIMATIONTYPE_VECTOR3,
    Animation.ANIMATIONLOOPMODE_CYCLE);
  animation.setKeys([{ frame: from, value: value.clone() }, { frame: to, value: value.clone() }]);
  return animation;
}

function validateRest(model: InspectionModel, scene: Scene): void {
  if (scene.isDisposed || model.root.isDisposed() || model.root.getScene() !== scene) {
    throw new Error('La escena de locomoción no está disponible.');
  }
  if (model.container.animationGroups.some(group => group.isStarted)) {
    throw new Error('Crea la locomoción equipada antes de reproducir cualquier animación.');
  }
  if (!Matrix.Compose(model.root.scaling, model.root.rotationQuaternion ?? Quaternion.FromEulerVector(model.root.rotation),
    model.root.position).equalsWithEpsilon(Matrix.Identity(), 1e-7) || model.root.parent) {
    throw new Error('Crea la locomoción antes de transformar el contenedor exterior de Ruen.');
  }
  for (const bone of model.container.skeletons[0]?.bones ?? []) {
    const node = bone.getTransformNode();
    if (!node || !node.rotationQuaternion || !Matrix.Compose(node.scaling, node.rotationQuaternion, node.position)
      .equalsWithEpsilon(bone.getRestMatrix(), 1e-5)) {
      throw new Error(`La pose importada fue modificada en «${bone.name}».`);
    }
  }
}

/**
 * Creates three stopped, caller-owned groups before any playback/root fitting.
 * Append Object.values(result) to model.container.animationGroups to register
 * stop/reset/disposal. The source groups, immutable report and node poses stay
 * unchanged. equipped=false provides a complete neutral fallback if gear fails.
 * Every group covers the same channel union, so weighted transitions cannot
 * retain a leg or finger pose from a previously playing clip.
 */
export function createRuenEquippedLocomotion(
  model: InspectionModel, scene: Scene, equipped = true,
): RuenEquippedLocomotion {
  validateRest(model, scene);
  const sources = { walk: sourceGroup(model, 'Walking'), run: sourceGroup(model, 'Running') };
  const names = equipped ? ruenEquippedLocomotionNames : ruenUnarmedLocomotionNames;
  for (const name of Object.values(names)) if (scene.animationGroups.some(group => group.name === name)) {
    throw new Error(`La escena ya contiene «${name}»; se conserva la animación existente.`);
  }
  const helpers: AnimationGroup[] = [], created: AnimationGroup[] = [];
  try {
    const neutral = createRuenIdlePreview(model, scene); helpers.push(neutral);
    const idleSource = equipped ? createRuenEquippedIdlePreview(model, scene, neutral) : neutral;
    if (idleSource !== neutral) helpers.push(idleSource);
    const channels = collectChannels([sources.walk, sources.run, idleSource], model);
    const grip = new Map<TransformNode, Quaternion>();
    if (equipped) for (const { target, animation } of idleSource.targetedAnimations) {
      if (isGripRotation(target, animation.targetProperty)) grip.set(target, animation.getKeys()[0]!.value.clone());
    }
    const build = (kind: 'idle' | 'walk' | 'run'): AnimationGroup => {
      const source = kind === 'idle' ? idleSource : sources[kind];
      const group = new AnimationGroup(names[kind], scene); created.push(group);
      const from = source.from, to = source.to;
      const fps = kind === 'idle' ? ruenIdlePreviewProfile.fps : source.targetedAnimations[0]!.animation.framePerSecond;
      for (const channel of channels) {
        const original = source.targetedAnimations.find(track => track.target === channel.target && track.animation.targetProperty === channel.property);
        const hold = kind !== 'idle' && equipped && isGripRotation(channel.target, channel.property) ? grip.get(channel.target) : undefined;
        // Keep original body, pelvis, leg and shoulder keys byte-for-byte in
        // independent Animation objects. Only the fitted arm/grip rotations
        // replace the broad imported arm swing; shoulders still follow gait.
        const animation = hold ? constantTrack(channel, group.name, from, to, fps, hold) : original ?
          original.animation.clone(true) : constantTrack(channel, group.name, from, to, fps);
        animation.name = `${group.name}:${channel.target.name}:${channel.property}`;
        group.addTargetedAnimation(animation, channel.target);
      }
      group.from = from; group.to = to;
      return group;
    };
    return { idle: build('idle'), walk: build('walk'), run: build('run') };
  } catch (error) {
    for (const group of created) group.dispose();
    throw error;
  } finally {
    for (const group of helpers) group.dispose();
  }
}
