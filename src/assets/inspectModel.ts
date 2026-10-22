import type { Scene } from '@babylonjs/core/scene';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { GLTFLoaderAnimationStartMode } from '@babylonjs/loaders/glTF/glTFFileLoader';
import '@babylonjs/loaders/glTF';

export interface InspectionReport {
  animationGroups: { name: string; from: number; to: number; fps: number; durationSeconds: number }[];
  skeletons: { name: string; bones: string[] }[];
  meshes: { name: string; vertices: number; triangles: number; skeleton: string | null }[];
  materials: { name: string; type: string; textures: { name: string; width: number; height: number }[] }[];
  /** These are declarations read from the file, not an inferred list of enabled loader plugins. */
  extensionsUsed: string[];
  extensionsRequired: string[];
  extensionSource: 'glTF JSON declarations';
}

export interface InspectionModel {
  root: TransformNode;
  container: AssetContainer;
  report: InspectionReport;
  player: SingleClipPlayer;
  dispose(): void;
}

/** This player belongs only to the inspector. It never updates game state or deals damage. */
export class SingleClipPlayer {
  private selected: AnimationGroup | null = null;
  private ratio = 1;
  constructor(private readonly groups: readonly AnimationGroup[]) {
    this.stopAll();
  }
  get currentName(): string | null { return this.selected?.name ?? null; }
  get current(): AnimationGroup | null { return this.selected; }
  get isPlaying(): boolean { return this.selected?.isPlaying ?? false; }
  get speed(): number { return this.ratio; }

  select(name: string): void {
    const next = this.groups.find(group => group.name === name);
    if (!next) throw new Error(`El archivo no contiene el clip «${name}».`);
    this.stopAll();
    this.selected = next;
    next.start(true, this.ratio);
    next.goToFrame(next.from);
  }
  pause(): void { this.selected?.pause(); }
  play(): void { this.selected?.play(true); }
  setSpeed(value: number): void {
    if (!Number.isFinite(value) || value <= 0 || value > 4) throw new Error('La velocidad debe ser mayor que 0 y como máximo 4.');
    this.ratio = value;
    if (this.selected) this.selected.speedRatio = value;
  }
  stopAll(): void {
    for (const group of this.groups) {
      // reset() on an INACTIVE Babylon group starts it temporarily. Only reset
      // active/paused groups, while their runtimes still retain original values.
      if (group.isStarted) group.reset();
      group.stop(true);
    }
    this.selected = null;
  }
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** No file is written or optimized: both File and URL sources are read as supplied. */
export async function loadInspectionModel(source: File | string, scene: Scene): Promise<InspectionModel> {
  let extensionsUsed: string[] = [], extensionsRequired: string[] = [];
  const container = await LoadAssetContainerAsync(source, scene, {
    pluginExtension: '.glb',
    pluginOptions: {
      gltf: {
        animationStartMode: GLTFLoaderAnimationStartMode.NONE,
        onParsed: ({ json }) => {
          const declarations = json as { extensionsUsed?: unknown; extensionsRequired?: unknown };
          extensionsUsed = stringList(declarations.extensionsUsed);
          extensionsRequired = stringList(declarations.extensionsRequired);
        },
      },
    },
  });
  // A load may finish after its inspector has been closed.
  if (scene.isDisposed) {
    container.dispose();
    throw new Error('La escena se cerró antes de terminar la carga.');
  }
  return instantiateInspectionModel(container, scene, extensionsUsed, extensionsRequired);
}

/** Exported for structural tests with Babylon containers; no substitute hero is generated. */
export function instantiateInspectionModel(
  container: AssetContainer, scene: Scene, extensionsUsed: string[] = [], extensionsRequired: string[] = [],
): InspectionModel {
  const root = new TransformNode('ruen-inspection-container', scene);
  const player = new SingleClipPlayer(container.animationGroups);
  try {
    container.addAllToScene();
    container.populateRootNodes();
    // Preserve the glTF conversion node, joint hierarchy and skinned mesh transforms.
    // All inspection scaling/yaw adjustments belong to this new exterior node.
    for (const node of container.rootNodes) if (!node.parent) node.parent = root;
    const report: InspectionReport = {
      animationGroups: container.animationGroups.map(group => {
        const fps = group.targetedAnimations[0]?.animation.framePerSecond ?? 60;
        return { name: group.name, from: group.from, to: group.to, fps, durationSeconds: (group.to - group.from) / fps };
      }),
      skeletons: container.skeletons.map(skeleton => ({ name: skeleton.name, bones: skeleton.bones.map(bone => bone.name) })),
      meshes: container.meshes.map(mesh => ({
        name: mesh.name, vertices: mesh.getTotalVertices(), triangles: mesh.getTotalIndices() / 3, skeleton: mesh.skeleton?.name ?? null,
      })),
      materials: container.materials.map(material => ({
        name: material.name, type: material.getClassName(),
        textures: material.getActiveTextures().map(texture => ({ name: texture.name, ...texture.getSize() })),
      })),
      extensionsUsed: [...extensionsUsed], extensionsRequired: [...extensionsRequired],
      extensionSource: 'glTF JSON declarations',
    };
    let disposed = false;
    return {
      root, container, report, player,
      dispose: () => {
        if (disposed) return;
        disposed = true;
        player.stopAll();
        container.dispose();
        root.dispose();
      },
    };
  } catch (error) {
    player.stopAll();
    container.dispose();
    root.dispose();
    throw error;
  }
}
