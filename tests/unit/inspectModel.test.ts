import { afterEach, describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { AssetContainer } from '@babylonjs/core/assetContainer';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { Animation } from '@babylonjs/core/Animations/animation';
import { Skeleton } from '@babylonjs/core/Bones/skeleton';
import { Bone } from '@babylonjs/core/Bones/bone';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { GLTFLoaderAnimationStartMode } from '@babylonjs/loaders/glTF/glTFFileLoader';
import { instantiateInspectionModel, loadInspectionModel, SingleClipPlayer } from '../../src/assets/inspectModel';

vi.mock('@babylonjs/core/Loading/sceneLoader', async importOriginal => ({
  ...await importOriginal<typeof import('@babylonjs/core/Loading/sceneLoader')>(),
  LoadAssetContainerAsync: vi.fn(),
}));

const engines: NullEngine[] = [];
function setup() {
  const engine = new NullEngine(); engines.push(engine);
  const scene = new Scene(engine);
  const node = new TransformNode('joint', scene);
  function clip(name: string, property: string, from: number, to: number, duration = 60) {
    const group = new AnimationGroup(name, scene);
    const animation = new Animation(name, property, 60, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
    animation.setKeys([{ frame: 0, value: from }, { frame: duration, value: to }]);
    group.addTargetedAnimation(animation, node);
    return group;
  }
  return { scene, node, clip };
}
afterEach(() => {
  for (const engine of engines.splice(0)) engine.dispose();
  vi.clearAllMocks();
});

describe('isolated asset inspection', () => {
  it('requests NONE autoplay per load and reads only actual glTF extension declarations', async () => {
    const { scene } = setup();
    const container = new AssetContainer(scene);
    vi.mocked(LoadAssetContainerAsync).mockImplementationOnce(async (_source, _scene, options) => {
      expect(options?.pluginExtension).toBe('.glb');
      expect(options?.pluginOptions?.gltf?.animationStartMode).toBe(GLTFLoaderAnimationStartMode.NONE);
      options?.pluginOptions?.gltf?.onParsed?.({
        json: { extensionsUsed: ['KHR_materials_unlit', 123], extensionsRequired: ['KHR_materials_unlit'] }, bin: null,
      });
      return container;
    });
    const model = await loadInspectionModel('test-only.glb', scene);
    expect(model.report.extensionsUsed).toEqual(['KHR_materials_unlit']);
    expect(model.report.extensionsRequired).toEqual(['KHR_materials_unlit']);
    expect(model.report.extensionSource).toBe('glTF JSON declarations');
    expect(model.player.currentName).toBeNull();
    expect(model.player.isPlaying).toBe(false);
    model.dispose();
  });

  it('retains the complete hierarchy, skin and local transforms under one exterior node', () => {
    const { scene, node, clip } = setup();
    const container = new AssetContainer(scene);
    const importedRoot = new TransformNode('__root__', scene);
    importedRoot.scaling.z = -1;
    node.parent = importedRoot; node.position.y = 0.9;
    const mesh = new Mesh('Actual mesh name', scene); mesh.parent = node;
    const skeleton = new Skeleton('Actual skin name', 'skin', scene);
    new Bone('Actual joint name', skeleton);
    mesh.skeleton = skeleton;
    const material = new StandardMaterial('Actual material name', scene); mesh.material = material;
    const walking = clip('Walking', 'position.x', 0, 0.1, 62);
    container.transformNodes.push(importedRoot, node);
    container.meshes.push(mesh); container.skeletons.push(skeleton);
    container.materials.push(material); container.animationGroups.push(walking);
    container.removeAllFromScene();
    const model = instantiateInspectionModel(container, scene);
    expect(importedRoot.parent).toBe(model.root);
    expect(node.parent).toBe(importedRoot);
    expect(mesh.parent).toBe(node);
    expect(mesh.skeleton).toBe(skeleton);
    expect(node.position.y).toBe(0.9);
    expect(importedRoot.scaling.z).toBe(-1);
    expect(model.root.scaling.asArray()).toEqual([1, 1, 1]);
    expect(model.report.skeletons).toEqual([{ name: 'Actual skin name', bones: ['Actual joint name'] }]);
    expect(model.report.materials[0]?.name).toBe('Actual material name');
    expect(model.report.meshes[0]?.skeleton).toBe('Actual skin name');
    expect(model.report.animationGroups[0]?.durationSeconds).toBeCloseTo(62 / 60);
    expect(walking.isStarted).toBeFalsy();
    model.dispose(); model.dispose();
    expect(mesh.isDisposed()).toBe(true);
    expect(model.root.isDisposed()).toBe(true);
    expect(scene.skeletons).toHaveLength(0);
    expect(scene.animationGroups).toHaveLength(0);
  });

  it('plays at most one clip, restores channels before switching and resumes a paused clip', () => {
    const { scene, node, clip } = setup();
    node.position.x = 0.4;
    const walking = clip('Walking', 'position.x', 0.4, 2);
    const running = clip('Running', 'position.y', 0, 1);
    const unused = clip('Unused', 'rotation.y', 0, 1);
    const unusedStart = vi.spyOn(unused, 'start');
    const player = new SingleClipPlayer([walking, running, unused]);
    player.select('Walking'); walking.goToFrame(30);
    expect(node.position.x).toBeCloseTo(1.2);
    player.pause(); expect(walking.isStarted).toBe(true); expect(player.isPlaying).toBe(false);
    player.play(); expect(player.isPlaying).toBe(true);
    player.setSpeed(1.5);
    player.select('Running');
    expect(node.position.x).toBeCloseTo(0.4);
    expect(walking.isStarted).toBe(false);
    expect(running.isStarted).toBe(true);
    expect(running.speedRatio).toBe(1.5);
    expect(scene.animationGroups.filter(group => group.isPlaying)).toEqual([running]);
    expect(unusedStart).not.toHaveBeenCalled();
    expect(() => player.select('Idle')).toThrow('no contiene');
    expect(player.currentName).toBe('Running');
    expect(() => player.setSpeed(Number.NaN)).toThrow();
    expect(() => player.setSpeed(0)).toThrow();
    player.stopAll();
    expect(player.currentName).toBeNull();
    expect(scene.animationGroups.every(group => !group.isStarted)).toBe(true);
  });

  it('disposes a late result if its scene has already closed', async () => {
    const { scene } = setup();
    const container = new AssetContainer(scene);
    const dispose = vi.spyOn(container, 'dispose');
    vi.mocked(LoadAssetContainerAsync).mockResolvedValueOnce(container);
    scene.dispose();
    await expect(loadInspectionModel('late.glb', scene)).rejects.toThrow('se cerró');
    expect(dispose).toHaveBeenCalled();
  });
});
