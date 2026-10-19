import { describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { AssetContainer } from '@babylonjs/core/assetContainer';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { assetUrl, characterAssets } from '../../src/assets/assetCatalog';
import { instantiateModel, loadCharacterModel } from '../../src/assets/ModelLoader';

describe('asset integration foundation', () => {
  it('resolves assets under a static hosting subdirectory', () => {
    expect(assetUrl('assets/models/ruen.glb', '/Veylun/')).toBe('/Veylun/assets/models/ruen.glb');
    expect(assetUrl('assets/models/ruen.glb', './')).toBe('./assets/models/ruen.glb');
    expect(() => assetUrl('../secret')).toThrow();
    expect(() => assetUrl('/assets/ruen.glb')).toThrow();
  });
  it('rejects absent character models without inventing a download path', async () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    try { await expect(loadCharacterModel(characterAssets.ruen, scene)).rejects.toThrow('No 3D model'); }
    finally { scene.dispose(); engine.dispose(); }
  });
  it('preserves model hierarchy, maps clips and disposes owned resources', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    try {
      const container = new AssetContainer(scene);
      const modelRoot = new TransformNode('gltf-root', scene);
      const body = new Mesh('body', scene);
      const sword = new Mesh('sword', scene);
      body.parent = modelRoot;
      sword.parent = body;
      container.transformNodes.push(modelRoot);
      container.meshes.push(body, sword);
      const clip = new AnimationGroup('Ruen_Idle', scene);
      container.animationGroups.push(clip);
      container.removeAllFromScene();
      const result = instantiateModel(container, { ...characterAssets.ruen, animationNames: { idle: 'Ruen_Idle', run: 'missing-clip' } }, scene);
      expect(modelRoot.parent).toBe(result.root);
      expect(sword.parent).toBe(body);
      expect(result.animations.idle).toBe(clip);
      expect(result.animations.run).toBeUndefined();
      result.dispose();
      expect(body.isDisposed()).toBe(true);
      expect(sword.isDisposed()).toBe(true);
      expect(result.root.isDisposed()).toBe(true);
      expect(scene.animationGroups).toHaveLength(0);
    } finally { scene.dispose(); engine.dispose(); }
  });
});
