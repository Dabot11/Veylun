import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { AssetContainer } from '@babylonjs/core/assetContainer';
import { Bone } from '@babylonjs/core/Bones/bone';
import { Skeleton } from '@babylonjs/core/Bones/skeleton';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Animation } from '@babylonjs/core/Animations/animation';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { Matrix, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { instantiateInspectionModel } from '../../src/assets/inspectModel';
import { createRuenIdlePreview, ruenIdlePreviewProfile } from '../../src/assets/ruenIdlePreview';

const engines: NullEngine[] = [];

function fixture() {
  const engine = new NullEngine(); engines.push(engine);
  const scene = new Scene(engine), container = new AssetContainer(scene);
  const skeleton = new Skeleton('SmartRigArmature', 'rig', scene); container.skeletons.push(skeleton);
  const character = new TransformNode('target_character', scene); container.transformNodes.push(character);
  character.position.set(0.3, 0.2, -0.1);
  const nodes = new Map<string, TransformNode>(), bones = new Map<string, Bone>();
  const add = (name: string, parent: string | null, x = 0) => {
    const node = new TransformNode(name, scene);
    node.parent = parent ? nodes.get(parent)! : character;
    node.position.set(x, 0.12, 0.01);
    node.rotationQuaternion = Quaternion.RotationYawPitchRoll(0.02, 0.2, -0.01);
    const bone = new Bone(name, skeleton, parent ? bones.get(parent)! : null, Matrix.Identity());
    bone.linkTransformNode(node); bones.set(name, bone); nodes.set(name, node); container.transformNodes.push(node);
  };
  add('mixamorig:Hips', null);
  add('mixamorig:Spine', 'mixamorig:Hips'); add('mixamorig:Spine1', 'mixamorig:Spine'); add('mixamorig:Spine2', 'mixamorig:Spine1');
  add('mixamorig:Neck', 'mixamorig:Spine2'); add('mixamorig:Head', 'mixamorig:Neck');
  for (const side of ['Left', 'Right']) {
    add(`mixamorig:${side}UpLeg`, 'mixamorig:Hips', side === 'Left' ? -0.1 : 0.1);
    add(`mixamorig:${side}Leg`, `mixamorig:${side}UpLeg`);
    add(`mixamorig:${side}Foot`, `mixamorig:${side}Leg`);
    add(`mixamorig:${side}ToeBase`, `mixamorig:${side}Foot`);
    add(`mixamorig:${side}Toe_End`, `mixamorig:${side}ToeBase`);
  }
  // The fixture exercises the required links; unused joints fill the real rig's
  // count without pretending to reproduce its mesh or visual quality.
  while (skeleton.bones.length < 80) add(`unused-${skeleton.bones.length}`, 'mixamorig:Spine2');
  const walking = new AnimationGroup('Walking', scene);
  const source = new Animation('source', 'rotationQuaternion', 30, Animation.ANIMATIONTYPE_QUATERNION);
  source.setKeys([{ frame: 0, value: Quaternion.Identity() }, { frame: 30, value: Quaternion.RotationYawPitchRoll(0.2, 0, 0) }]);
  walking.addTargetedAnimation(source, nodes.get('mixamorig:Spine1')!); container.animationGroups.push(walking);
  container.removeAllFromScene();
  const model = instantiateInspectionModel(container, scene);
  model.root.scaling.setAll(1.45 / 1.7); model.root.rotation.y = 0.4;
  return { scene, container, skeleton, nodes, model, walking };
}

function localPose(node: TransformNode) {
  return { position: node.position.asArray(), rotation: node.rotationQuaternion?.asArray(), scale: node.scaling.asArray(), parent: node.parent };
}

afterEach(() => { for (const engine of engines.splice(0)) engine.dispose(); });

describe('Ruen authored Idle preview', () => {
  it('creates a stopped separate group without changing the master report, source clips or local poses', () => {
    const { scene, model, nodes, walking } = fixture();
    const report = structuredClone(model.report), source = walking.serialize();
    const before = [...nodes.values()].map(localPose);
    const idle = createRuenIdlePreview(model, scene);
    expect(idle.name).toBe('Ruen_Idle_v1'); expect(idle.from).toBe(0); expect(idle.to).toBe(120);
    expect(idle.isStarted).toBeFalsy(); expect(idle.isPlaying).toBeFalsy();
    expect(model.container.animationGroups).toEqual([walking]); expect(model.report).toEqual(report);
    expect(walking.serialize()).toEqual(source); expect([...nodes.values()].map(localPose)).toEqual(before);
    expect(idle.targetedAnimations.map(track => [track.target.name, track.animation.targetProperty])).toEqual([
      ['mixamorig:Spine1', 'rotationQuaternion'], ['mixamorig:Spine2', 'rotationQuaternion'],
    ]);
    expect(idle.targetedAnimations.every(track => track.animation.framePerSecond === 30)).toBe(true);
    expect(ruenIdlePreviewProfile.rotations.reduce((sum, track) => sum + track.maxDegrees, 0)).toBeLessThan(2);
  });

  it('moves the upper body while root, pelvis, feet and their bind matrices stay unchanged', () => {
    const { scene, model, nodes, skeleton } = fixture();
    const frozen = [model.root, ...[...nodes.entries()].filter(([name]) => /Hips|UpLeg|Leg|Foot|Toe/.test(name)).map(([, node]) => node)];
    const before = frozen.map(node => ({ local: localPose(node), world: Array.from(node.computeWorldMatrix(true).m) }));
    const bindMatrices = skeleton.bones.map(bone => Array.from(bone.getBindMatrix().m));
    const torso = nodes.get('mixamorig:Spine2')!, head = nodes.get('mixamorig:Head')!;
    const rest = torso.rotationQuaternion!.clone(), headBefore = head.getAbsolutePosition().clone();
    const idle = createRuenIdlePreview(model, scene); idle.start(true); idle.pause(); idle.goToFrame(60);
    expect(torso.rotationQuaternion!.equalsWithEpsilon(rest, 0.0001)).toBe(false);
    head.computeWorldMatrix(true); expect(head.getAbsolutePosition().equalsWithEpsilon(headBefore, 0.0001)).toBe(false);
    for (let index = 0; index < frozen.length; index++) {
      expect(localPose(frozen[index]!)).toEqual(before[index]!.local);
      expect(Array.from(frozen[index]!.computeWorldMatrix(true).m)).toEqual(before[index]!.world);
    }
    expect(skeleton.bones.map(bone => Array.from(bone.getBindMatrix().m))).toEqual(bindMatrices);
    expect(idle.targetedAnimations.every(track => track.animation.targetProperty === 'rotationQuaternion')).toBe(true);
  });

  it('closes the real sampled loop at the base pose with matching near-zero angular velocity', () => {
    const { scene, model, nodes } = fixture();
    const torso = nodes.get('mixamorig:Spine2')!, rest = torso.rotationQuaternion!.clone();
    const idle = createRuenIdlePreview(model, scene); idle.start(true); idle.pause();
    const sample = (frame: number) => { idle.goToFrame(frame); return torso.rotationQuaternion!.clone(); };
    const start = sample(0), end = sample(120);
    expect(start.asArray()).toEqual(rest.asArray()); expect(end.asArray()).toEqual(rest.asArray());
    const deltaFrame = 0.3, seconds = deltaFrame / 30;
    const componentRate = (a: Quaternion, b: Quaternion) => Math.hypot(...a.asArray().map((value, index) => (value - b.asArray()[index]!) / seconds));
    expect(componentRate(sample(deltaFrame), start)).toBeLessThan(0.0001);
    expect(componentRate(end, sample(120 - deltaFrame))).toBeLessThan(0.0001);
    expect(componentRate(sample(30 + deltaFrame), sample(30))).toBeGreaterThan(0.003);
    expect(sample(30).equalsWithEpsilon(sample(90), 1e-10)).toBe(true);
  });

  it('lets the caller reset and dispose the preview independently from the imported model', () => {
    const { scene, model, nodes, walking } = fixture();
    const torso = nodes.get('mixamorig:Spine2')!, rest = torso.rotationQuaternion!.clone();
    const idle = createRuenIdlePreview(model, scene); idle.start(true); idle.goToFrame(60);
    idle.reset(); idle.stop(true); idle.dispose();
    expect(torso.rotationQuaternion!.asArray()).toEqual(rest.asArray());
    expect(scene.animationGroups.includes(idle)).toBe(false); expect(model.root.isDisposed()).toBe(false);
    expect(model.container.animationGroups).toEqual([walking]); expect(!!walking.isStarted).toBe(false);
  });

  it('rejects missing or ambiguous joints and an altered leg hierarchy without adding a group', () => {
    for (const alter of ['missing', 'duplicate', 'hierarchy', 'unlinked', 'wrong-skeleton'] as const) {
      const { scene, model, nodes, skeleton } = fixture();
      if (alter === 'missing') nodes.get('mixamorig:Spine1')!.name = 'renamed';
      if (alter === 'duplicate') model.container.transformNodes.push(new TransformNode('mixamorig:Spine1', scene));
      if (alter === 'hierarchy') nodes.get('mixamorig:LeftUpLeg')!.parent = nodes.get('mixamorig:Spine1')!;
      if (alter === 'unlinked') skeleton.bones.find(bone => bone.name === 'mixamorig:Spine1')!.linkTransformNode(null);
      if (alter === 'wrong-skeleton') skeleton.name = 'another-rig';
      const groupsBefore = [...scene.animationGroups];
      expect(() => createRuenIdlePreview(model, scene)).toThrow(); expect(scene.animationGroups).toEqual(groupsBefore);
    }
  });

  it('rejects capture after a source clip starts instead of baking an animated pose as rest', () => {
    const { scene, model, walking } = fixture(); walking.start(true); walking.pause();
    const groupsBefore = [...scene.animationGroups];
    expect(() => createRuenIdlePreview(model, scene)).toThrow('antes de reproducir');
    expect(scene.animationGroups).toEqual(groupsBefore);
  });

  it('preserves an existing clip with the preview name instead of creating an ambiguous duplicate', () => {
    const { scene, model } = fixture();
    const original = new AnimationGroup('Ruen_Idle_v1', scene);
    model.container.animationGroups.push(original);
    const groupsBefore = [...scene.animationGroups], importedBefore = [...model.container.animationGroups];
    expect(() => createRuenIdlePreview(model, scene)).toThrow('ya contiene un clip');
    expect(scene.animationGroups).toEqual(groupsBefore); expect(model.container.animationGroups).toEqual(importedBefore);
    expect(model.container.animationGroups.find(group => group.name === 'Ruen_Idle_v1')).toBe(original);
  });
});
