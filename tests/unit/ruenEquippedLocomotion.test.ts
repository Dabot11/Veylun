import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { AssetContainer } from '@babylonjs/core/assetContainer';
import { Bone } from '@babylonjs/core/Bones/bone';
import { Skeleton } from '@babylonjs/core/Bones/skeleton';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Animation } from '@babylonjs/core/Animations/animation';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { instantiateInspectionModel } from '../../src/assets/inspectModel';
import { createRuenEquippedLocomotion } from '../../src/assets/ruenEquippedLocomotion';

const engines: NullEngine[] = [];

/** Complete required hierarchy; real-mesh fitting is checked in the browser. */
function fixture() {
  const engine = new NullEngine(); engines.push(engine);
  const scene = new Scene(engine), container = new AssetContainer(scene);
  const conversion = new TransformNode('gltf-conversion', scene);
  conversion.rotationQuaternion = new Quaternion(0, 1, 0, 0); conversion.scaling.z = -1;
  const character = new TransformNode('target_character', scene); character.parent = conversion;
  container.transformNodes.push(conversion, character);
  const skeleton = new Skeleton('SmartRigArmature', 'rig', scene); container.skeletons.push(skeleton);
  const nodes = new Map<string, TransformNode>(), bones = new Map<string, Bone>();
  const add = (suffix: string, parent: string | null, position = new Vector3(0, 0.1, 0)) => {
    const name = suffix.startsWith('unused') ? suffix : `mixamorig:${suffix}`;
    const node = new TransformNode(name, scene);
    node.parent = parent ? nodes.get(`mixamorig:${parent}`)! : character;
    node.position.copyFrom(position); node.rotationQuaternion = Quaternion.RotationYawPitchRoll(0.01, 0.03, -0.01);
    const rest = Matrix.Compose(node.scaling, node.rotationQuaternion, node.position);
    const bone = new Bone(name, skeleton, parent ? bones.get(`mixamorig:${parent}`)! : null, rest);
    bone.linkTransformNode(node); nodes.set(name, node); bones.set(name, bone); container.transformNodes.push(node);
    return node;
  };
  add('Hips', null, new Vector3(0, 0.9, 0));
  add('Spine', 'Hips'); add('Spine1', 'Spine'); add('Spine2', 'Spine1');
  add('Neck', 'Spine2'); add('Head', 'Neck');
  for (const side of ['Left', 'Right']) {
    const sign = side === 'Left' ? -1 : 1;
    add(`${side}UpLeg`, 'Hips', new Vector3(sign * 0.1, -0.04, 0));
    add(`${side}Leg`, `${side}UpLeg`, new Vector3(0, -0.35, 0));
    add(`${side}Foot`, `${side}Leg`, new Vector3(0, -0.35, 0));
    add(`${side}ToeBase`, `${side}Foot`, new Vector3(0, 0, 0.1));
    add(`${side}Toe_End`, `${side}ToeBase`, new Vector3(0, 0, 0.04));
    add(`${side}Shoulder`, 'Spine2', new Vector3(sign * 0.1, 0.04, 0));
    add(`${side}Arm`, `${side}Shoulder`, new Vector3(sign * 0.12, -0.02, 0));
    add(`${side}ForeArm`, `${side}Arm`, new Vector3(sign * 0.04, -0.2, 0));
    add(`${side}Hand`, `${side}ForeArm`, new Vector3(sign * 0.03, -0.21, 0));
    for (const [fingerIndex, finger] of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'].entries()) {
      for (let part = 1; part <= 4; part++) {
        add(`${side}Hand${finger}${part}`, `${side}Hand${part === 1 ? '' : `${finger}${part - 1}`}`,
          new Vector3(part === 1 ? (sign * (fingerIndex - 2) * 0.012 || 0) : 0, part === 1 ? 0.08 : 0.025, 0));
      }
    }
  }
  while (skeleton.bones.length < 80) add(`unused-${skeleton.bones.length}`, 'Spine2');
  const sources = ['Walking', 'Running'].map((name, index) => {
    const group = new AnimationGroup(name, scene), end = index ? 36 : 60;
    for (const node of nodes.values()) {
      const rotation = new Animation(`${name}:${node.name}:rotation`, 'rotationQuaternion', 60, Animation.ANIMATIONTYPE_QUATERNION);
      rotation.setKeys([{ frame: 0, value: node.rotationQuaternion!.clone() },
        { frame: end / 2, value: node.rotationQuaternion!.multiply(Quaternion.RotationAxis(Vector3.Right(), 0.3 + index * 0.1)) },
        { frame: end, value: node.rotationQuaternion!.clone() }]);
      const position = new Animation(`${name}:${node.name}:position`, 'position', 60, Animation.ANIMATIONTYPE_VECTOR3);
      position.setKeys([{ frame: 0, value: node.position.clone() },
        { frame: end / 2, value: node.position.add(new Vector3(0.001, 0.002, 0.003)) },
        { frame: end, value: node.position.clone() }]);
      group.addTargetedAnimation(rotation, node); group.addTargetedAnimation(position, node);
    }
    container.animationGroups.push(group); return group;
  });
  container.removeAllFromScene();
  const model = instantiateInspectionModel(container, scene);
  const find = (suffix: string) => nodes.get(`mixamorig:${suffix}`)!;
  return { scene, model, skeleton, nodes, sources, find };
}

const pose = (node: TransformNode) => ({ position: node.position.asArray(), rotation: node.rotationQuaternion!.asArray(), scale: node.scaling.asArray() });
const keys = (group: AnimationGroup) => group.targetedAnimations.map(track => `${track.target.name}:${track.animation.targetProperty}`).sort();
const animationData = (animation: Animation) => ({ ...animation.serialize(), name: '' });
const gripTrack = (name: string, property: string) => property === 'rotationQuaternion' && /^mixamorig:(Left|Right)(Arm|ForeArm|Hand|Hand(Thumb|Index|Middle|Ring|Pinky)[1-3])$/.test(name);

afterEach(() => { for (const engine of engines.splice(0)) engine.dispose(); });

describe('equipped runtime locomotion clips', () => {
  it('owns three independent stopped groups with the same complete channels and unchanged source/rest data', () => {
    const { scene, model, skeleton, nodes, sources } = fixture();
    const before = [...nodes.values()].map(pose), report = structuredClone(model.report);
    const original = sources.map(group => group.serialize());
    const binds = skeleton.bones.map(bone => Array.from(bone.getBindMatrix().m));
    const groups = createRuenEquippedLocomotion(model, scene);
    expect(Object.values(groups).map(group => group.name)).toEqual(['Ruen_Idle_Equipped', 'Ruen_Walk_Equipped', 'Ruen_Run_Equipped']);
    for (const group of Object.values(groups)) {
      expect(group.isStarted).toBeFalsy(); expect(group.isPlaying).toBeFalsy();
      expect(group.targetedAnimations).toHaveLength(160); expect(keys(group)).toEqual(keys(sources[0]!));
      expect(new Set(keys(group)).size).toBe(160);
    }
    expect(groups.idle.to).toBe(120); expect(groups.idle.targetedAnimations[0]!.animation.framePerSecond).toBe(30);
    expect(groups.walk.to).toBe(sources[0]!.to); expect(groups.run.to).toBe(sources[1]!.to);
    expect([...nodes.values()].map(pose)).toEqual(before); expect(model.report).toEqual(report);
    expect(model.container.animationGroups).toEqual(sources); expect(sources.map(group => group.serialize())).toEqual(original);
    expect(skeleton.bones.map(bone => Array.from(bone.getBindMatrix().m))).toEqual(binds);
    expect(scene.animationGroups).toHaveLength(5);
    expect(scene.animationGroups.some(group => /v1/.test(group.name))).toBe(false);
    // Caller registration gives the model ownership; disposal removes all groups.
    model.container.animationGroups.push(...Object.values(groups)); model.dispose();
    expect(scene.animationGroups).toHaveLength(0);
  });

  it('preserves imported body/legs/shoulders and changes only arm/grip rotation tracks', () => {
    const { model, scene, sources } = fixture();
    const groups = createRuenEquippedLocomotion(model, scene);
    for (const [index, group] of [groups.walk, groups.run].entries()) {
      for (const track of sources[index]!.targetedAnimations) {
        const authored = group.targetedAnimations.find(item => item.target === track.target && item.animation.targetProperty === track.animation.targetProperty)!;
        expect(authored.animation).not.toBe(track.animation);
        if (!gripTrack(track.target.name, track.animation.targetProperty)) {
          expect(animationData(authored.animation)).toEqual(animationData(track.animation));
          expect(authored.animation.getKeys()[0]!.value).not.toBe(track.animation.getKeys()[0]!.value);
        } else {
          const idle = groups.idle.targetedAnimations.find(item => item.target === track.target && item.animation.targetProperty === 'rotationQuaternion')!;
          const held = idle.animation.getKeys()[0]!.value.asArray();
          expect(authored.animation.getKeys().map(key => key.value.asArray())).toEqual([held, held]);
          expect(authored.animation.framePerSecond).toBe(60);
        }
      }
    }
  });

  it('restores complete leg/body channels at Idle while keeping breathing and the held fingers', () => {
    const { model, scene, find } = fixture();
    const rest = ['Hips', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot'].map(name => pose(find(name)));
    const groups = createRuenEquippedLocomotion(model, scene);
    model.container.animationGroups.push(...Object.values(groups));
    model.player.select(groups.run.name); model.player.pause(); groups.run.goToFrame(groups.run.to / 2);
    expect(pose(find('LeftLeg'))).not.toEqual(rest[1]);
    // The complete Idle fixes all channels even if a caller directly blends away
    // from locomotion rather than using SingleClipPlayer's reset convenience.
    groups.run.stop(true); groups.idle.start(true); groups.idle.pause(); groups.idle.goToFrame(0);
    const first = pose(find('Spine1')), finger = pose(find('RightHandIndex2'));
    for (const frame of [0, 60, 120]) {
      groups.idle.goToFrame(frame);
      expect(['Hips', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot'].map(name => pose(find(name)))).toEqual(rest);
      expect(pose(find('RightHandIndex2'))).toEqual(finger);
      if (frame === 60) expect(pose(find('Spine1'))).not.toEqual(first);
      else expect(pose(find('Spine1'))).toEqual(first);
    }
  });

  it('provides a complete unarmed breathing fallback without retaining raised forearm or clenched fingers', () => {
    const { model, scene, nodes, sources, find } = fixture();
    const rest = [...nodes.values()].map(pose);
    const groups = createRuenEquippedLocomotion(model, scene, false);
    expect(Object.values(groups).map(group => group.name)).toEqual(['Ruen_Idle_Unarmed', 'Ruen_Walk_Unarmed', 'Ruen_Run_Unarmed']);
    expect(Object.values(groups).every(group => keys(group).join('|') === keys(sources[0]!).join('|'))).toBe(true);
    for (const [index, group] of [groups.walk, groups.run].entries()) {
      expect(group.targetedAnimations.map(track => animationData(track.animation))).toEqual(sources[index]!.targetedAnimations.map(track => animationData(track.animation)));
    }
    groups.idle.start(true); groups.idle.pause(); groups.idle.goToFrame(0);
    expect([...nodes.values()].map(pose)).toEqual(rest);
    groups.idle.goToFrame(60);
    expect(pose(find('Spine1'))).not.toEqual(rest[[...nodes.keys()].indexOf('mixamorig:Spine1')]);
    for (const name of ['LeftForeArm', 'RightHandIndex2']) {
      expect(pose(find(name))).toEqual(rest[[...nodes.keys()].indexOf(`mixamorig:${name}`)]);
    }
    expect(scene.animationGroups).toHaveLength(5);
  });

  it('rejects started/mutated rigs, transformed roots and duplicate authored names before adding groups', () => {
    const { model, scene, sources, find } = fixture();
    sources[0]!.start(true); expect(() => createRuenEquippedLocomotion(model, scene)).toThrow(/antes de reproducir/);
    model.player.stopAll();
    find('RightHand').position.x += 0.1;
    expect(() => createRuenEquippedLocomotion(model, scene)).toThrow(/pose importada/);
    find('RightHand').position.x -= 0.1;
    model.root.scaling.setAll(0.8);
    expect(() => createRuenEquippedLocomotion(model, scene)).toThrow(/contenedor exterior/);
    model.root.scaling.setAll(1);
    const groups = createRuenEquippedLocomotion(model, scene);
    expect(() => createRuenEquippedLocomotion(model, scene)).toThrow(/ya contiene/);
    expect(scene.animationGroups).toHaveLength(5);
    Object.values(groups).forEach(group => group.dispose());
    expect(scene.animationGroups).toHaveLength(2);
  });

  it('cleans helper groups when an unsupported source channel rejects construction', () => {
    const { model, scene, sources, find } = fixture();
    const bad = new Animation('bad-source', 'visibility', 60, Animation.ANIMATIONTYPE_FLOAT);
    bad.setKeys([{ frame: 0, value: 0 }, { frame: 60, value: 1 }]);
    sources[0]!.addTargetedAnimation(bad, find('Head'));
    expect(() => createRuenEquippedLocomotion(model, scene)).toThrow(/canales locales/);
    expect(scene.animationGroups).toEqual(sources);
    expect(model.container.animationGroups).toEqual(sources);
    expect(sources.every(group => !group.isStarted)).toBe(true);
  });
});
