import type { Scene } from '@babylonjs/core/scene';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF';
import { assetUrl, type CharacterAsset, type AnimationId } from './assetCatalog';

export interface ModelInstance {
  root: TransformNode;
  animations: Partial<Record<AnimationId, AnimationGroup>>;
  dispose(): void;
}

/** Load a visual child; keep controller/colliders on a separate simulation root. */
export async function loadCharacterModel(asset: CharacterAsset, scene: Scene): Promise<ModelInstance> {
  if (!asset.modelPath) throw new Error(`No 3D model is available for ${asset.id}.`);
  const container = await LoadAssetContainerAsync(assetUrl(asset.modelPath), scene);
  return instantiateModel(container, asset, scene);
}

export function instantiateModel(container: AssetContainer, asset: CharacterAsset, scene: Scene): ModelInstance {
  const root = new TransformNode(`${asset.id}-visual`, scene);
  try {
    container.addAllToScene();
    for (const node of [...container.meshes, ...container.transformNodes]) {
      if (!node.parent) node.parent = root;
    }
    const animations: ModelInstance['animations'] = {};
    for (const [logicalName, clipName] of Object.entries(asset.animationNames)) {
      const clip = container.animationGroups.find((group) => group.name === clipName);
      if (clip) animations[logicalName as AnimationId] = clip;
    }
    return {
      root, animations,
      dispose: () => { container.dispose(); root.dispose(); },
    };
  } catch (error) {
    container.dispose();
    root.dispose();
    throw error;
  }
}
