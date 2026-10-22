import { afterEach, describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { AssetContainer } from '@babylonjs/core/assetContainer';
import { Bone } from '@babylonjs/core/Bones/bone';
import { Skeleton } from '@babylonjs/core/Bones/skeleton';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Animation } from '@babylonjs/core/Animations/animation';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { loadInspectionModel, instantiateInspectionModel, type InspectionModel } from '../../src/assets/inspectModel';
import { ruenEquipmentProfiles } from '../../src/assets/ruenEquipmentProfile';
import { RuenEquipmentPreview } from '../../src/assets/RuenEquipmentPreview';

vi.mock('../../src/assets/inspectModel', async importOriginal => ({
  ...await importOriginal<typeof import('../../src/assets/inspectModel')>(),
  loadInspectionModel: vi.fn(),
}));
vi.mock('../../src/assets/ruenEquipmentProfile', async importOriginal => {
  const original = await importOriginal<typeof import('../../src/assets/ruenEquipmentProfile')>();
  return {
    ...original,
    // Nonzero pivots exercise the coordinate conversion independently of the
    // provisional visual fitting values, which can change during art review.
    ruenEquipmentProfiles: original.ruenEquipmentProfiles.map((profile, index) => ({
      ...profile, grip: [0.13, -0.28, 0.07], handOffset: [0.01, 0.08, -0.02],
      rotation: [0.3, -0.2, index ? 0.4 : -0.4], uniformScale: index ? 0.42 : 0.55,
    })),
  };
});

const engines: NullEngine[] = [];

function heroFixture() {
  const engine = new NullEngine(); engines.push(engine);
  const scene = new Scene(engine), container = new AssetContainer(scene);
  const conversion = new TransformNode('hero-gltf-conversion', scene); conversion.scaling.z = -1;
  container.transformNodes.push(conversion);
  const skeleton = new Skeleton('SmartRigArmature', 'hero-rig', scene); container.skeletons.push(skeleton);
  const hands = new Map<string, TransformNode>();
  for (let index = 0; index < 80; index++) {
    const name = index === 0 ? 'mixamorig:RightHand' : index === 1 ? 'mixamorig:LeftHand' : `unused-${index}`;
    const node = new TransformNode(name, scene); node.parent = conversion;
    node.position.set(index === 0 ? 0.3 : -0.3, 1.1, 0.05);
    node.rotationQuaternion = Quaternion.RotationYawPitchRoll(0.2, -0.4, 0.1);
    const bone = new Bone(name, skeleton, null, Matrix.Identity()); bone.linkTransformNode(node);
    container.transformNodes.push(node); if (index < 2) hands.set(name, node);
  }
  const idle = new AnimationGroup('hero-idle', scene);
  const animation = new Animation('hero-idle', 'rotationQuaternion', 30, Animation.ANIMATIONTYPE_QUATERNION);
  animation.setKeys([{ frame: 0, value: Quaternion.Identity() }, { frame: 120, value: Quaternion.RotationYawPitchRoll(0.01, 0, 0) }]);
  idle.addTargetedAnimation(animation, hands.get('mixamorig:RightHand')!); container.animationGroups.push(idle);
  container.removeAllFromScene();
  const hero = instantiateInspectionModel(container, scene);
  hero.root.position.set(2, 0.3, 4); hero.root.rotation.y = 0.7; hero.root.scaling.setAll(1.45 / 1.7);
  const preview = new RuenEquipmentPreview(scene, hero);
  return { scene, hero, skeleton, hands, idle, preview };
}

function equipmentFixture(scene: Scene, name: string) {
  const container = new AssetContainer(scene);
  const conversion = new TransformNode(`${name}-gltf-conversion`, scene);
  conversion.rotation.y = Math.PI; conversion.scaling.z = -1; container.transformNodes.push(conversion);
  const mesh = MeshBuilder.CreateBox(`${name}-mesh`, { width: 0.1, height: 1.4, depth: 0.08 }, scene); mesh.parent = conversion;
  const material = new PBRMaterial(`${name}-material`, scene); material.metallic = 0.8; material.roughness = 0.25;
  mesh.material = material; container.meshes.push(mesh); container.materials.push(material);
  const dormant = new AnimationGroup(`${name}-dormant`, scene);
  const animation = new Animation('dormant', 'position.y', 30, Animation.ANIMATIONTYPE_FLOAT);
  animation.setKeys([{ frame: 0, value: 0 }, { frame: 30, value: 1 }]);
  dormant.addTargetedAnimation(animation, mesh); container.animationGroups.push(dormant);
  container.removeAllFromScene();
  const model = instantiateInspectionModel(container, scene);
  return { model, conversion, mesh, material, dispose: vi.spyOn(model, 'dispose') };
}

function loadedFixture() {
  const fixture = heroFixture();
  const sword = equipmentFixture(fixture.scene, 'sword'), shield = equipmentFixture(fixture.scene, 'shield');
  vi.mocked(loadInspectionModel).mockResolvedValueOnce(sword.model).mockResolvedValueOnce(shield.model);
  return { ...fixture, sword, shield };
}

function localPose(node: TransformNode) {
  return { position: node.position.asArray(), rotation: node.rotationQuaternion?.asArray(), scale: node.scaling.asArray(), parent: node.parent };
}

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

afterEach(() => {
  for (const engine of engines.splice(0)) engine.dispose();
  vi.restoreAllMocks(); vi.resetAllMocks();
});

describe('Ruen equipment preview', () => {
  it('mounts the complete assets at their grip points without altering the hero, materials or conversion nodes', async () => {
    const { preview, hero, hands, sword, shield, idle } = loadedFixture();
    hero.player.select('hero-idle');
    const originalReport = structuredClone(hero.report), heroPose = [...hands.values()].map(localPose);
    const originalGroups = [...hero.container.animationGroups], originalNodes = [...hero.container.transformNodes];
    expect(preview.diagnostics.status).toBe('idle'); expect(loadInspectionModel).not.toHaveBeenCalled();
    await preview.load();
    expect(preview.diagnostics.status).toBe('ready'); expect(preview.models).toHaveLength(2);
    for (const [index, item] of preview.models.entries()) {
      const profile = ruenEquipmentProfiles[index]!, asset = index === 0 ? sword : shield, hand = hands.get(profile.hand)!;
      expect(item.mount.parent).toBe(hand); expect(item.model.root.parent).toBe(item.mount);
      expect(item.mount.scaling.asArray()).toEqual([profile.uniformScale, profile.uniformScale, profile.uniformScale]);
      expect(item.model.root.scaling.asArray()).toEqual([1, 1, 1]);
      expect(asset.conversion.parent).toBe(item.model.root); expect(asset.conversion.scaling.z).toBe(-1);
      expect(asset.conversion.rotation.y).toBe(Math.PI); expect(asset.mesh.material).toBe(asset.material);
      expect(asset.material.metallic).toBe(0.8); expect(asset.material.roughness).toBe(0.25);
      const gripWorld = Vector3.TransformCoordinates(Vector3.FromArray(profile.grip), item.model.root.computeWorldMatrix(true));
      const expectedWorld = Vector3.TransformCoordinates(Vector3.FromArray(profile.handOffset), hand.computeWorldMatrix(true));
      expect(gripWorld.equalsWithEpsilon(expectedWorld, 0.000001)).toBe(true);
      expect(item.model.container.animationGroups.every(group => !group.isStarted)).toBe(true);
    }
    expect([...hands.values()].map(localPose)).toEqual(heroPose); expect(hero.report).toEqual(originalReport);
    expect(hero.container.animationGroups).toEqual(originalGroups); expect(hero.container.transformNodes).toEqual(originalNodes);
    expect(idle.isPlaying).toBe(true);
    expect(preview.report.items.map(item => item.inventory?.materials[0]?.type)).toEqual(['PBRMaterial', 'PBRMaterial']);
    const exported = preview.report; exported.items[0]!.inventory!.materials.length = 0;
    expect(sword.model.report.materials).toHaveLength(1);
  });

  it('follows changed hand and hero transforms while visibility affects only the equipment', async () => {
    const { preview, hero, hands, idle } = loadedFixture();
    hero.player.select('hero-idle'); preview.setEnabled(false); await preview.load();
    expect(preview.models.every(item => !item.model.root.isEnabled())).toBe(true); expect(hero.root.isEnabled()).toBe(true);
    const item = preview.models[0]!, profile = ruenEquipmentProfiles[0]!, hand = hands.get(profile.hand)!;
    const before = item.model.root.computeWorldMatrix(true).clone();
    hand.position.x += 0.4; hand.rotationQuaternion = Quaternion.RotationYawPitchRoll(-0.7, 0.4, 0.1); hero.root.position.z += 2;
    preview.setEnabled(true);
    const after = item.model.root.computeWorldMatrix(true);
    expect(after.equals(before)).toBe(false);
    const gripWorld = Vector3.TransformCoordinates(Vector3.FromArray(profile.grip), after);
    const expectedWorld = Vector3.TransformCoordinates(Vector3.FromArray(profile.handOffset), hand.computeWorldMatrix(true));
    expect(gripWorld.equalsWithEpsilon(expectedWorld, 0.000001)).toBe(true);
    expect(preview.models.every(asset => asset.model.root.isEnabled())).toBe(true);
    expect(hero.root.isEnabled()).toBe(true); expect(idle.isPlaying).toBe(true);
  });

  it('retains one available item when the other download fails, and never reloads an existing result', async () => {
    const { preview, scene, hero } = heroFixture(), sword = equipmentFixture(scene, 'sword');
    vi.mocked(loadInspectionModel).mockResolvedValueOnce(sword.model).mockRejectedValueOnce(new Error('shield unavailable'));
    await preview.load();
    expect(preview.diagnostics.status).toBe('partial'); expect(preview.models.map(item => item.kind)).toEqual(['sword']);
    expect(preview.diagnostics.items.find(item => item.kind === 'shield')?.error).toBe('shield unavailable');
    expect(hero.root.isDisposed()).toBe(false); expect(sword.dispose).not.toHaveBeenCalled();
    await preview.load(); expect(loadInspectionModel).toHaveBeenCalledTimes(2);
    expect(scene.transformNodes.filter(node => node.name.startsWith('ruen-equipment-') && node.name.endsWith('-mount'))).toHaveLength(1);
  });

  it('validates individual hand links and refuses an incompatible skeleton before downloading anything', async () => {
    const first = heroFixture(), shield = equipmentFixture(first.scene, 'shield');
    const duplicate = new TransformNode('mixamorig:RightHand', first.scene); first.hero.container.transformNodes.push(duplicate);
    vi.mocked(loadInspectionModel).mockResolvedValueOnce(shield.model);
    await first.preview.load();
    expect(first.preview.diagnostics.status).toBe('partial'); expect(first.preview.models[0]?.kind).toBe('shield');
    expect(first.preview.diagnostics.items[0]?.error).toContain('articulación única');
    expect(loadInspectionModel).toHaveBeenCalledTimes(1);
    vi.mocked(loadInspectionModel).mockClear();
    const second = heroFixture(); second.skeleton.name = 'different-rig'; await second.preview.load();
    expect(second.preview.diagnostics.status).toBe('error'); expect(loadInspectionModel).not.toHaveBeenCalled();
    expect(second.preview.models).toEqual([]); expect(second.hero.root.isDisposed()).toBe(false);
  });

  it('loads in parallel once and disposes both completed and late assets without leaking mounts', async () => {
    const { preview, scene, hero } = heroFixture();
    const sword = equipmentFixture(scene, 'sword'), shield = equipmentFixture(scene, 'shield');
    const first = deferred<InspectionModel>(), second = deferred<InspectionModel>();
    vi.mocked(loadInspectionModel).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const loading = preview.load(), repeated = preview.load();
    expect(loadInspectionModel).toHaveBeenCalledTimes(2); expect(preview.diagnostics.status).toBe('loading');
    first.resolve(sword.model); await Promise.resolve(); await Promise.resolve();
    expect(preview.models).toHaveLength(1);
    const mount = preview.models[0]!.mount;
    preview.dispose(); second.resolve(shield.model); await Promise.all([loading, repeated]);
    expect(sword.dispose).toHaveBeenCalledTimes(1); expect(shield.dispose).toHaveBeenCalledTimes(1);
    expect(mount.isDisposed()).toBe(true); expect(preview.models).toEqual([]); expect(preview.diagnostics.status).toBe('disposed');
    expect(scene.transformNodes.some(node => node.name.startsWith('ruen-equipment-'))).toBe(false);
    expect(hero.root.isDisposed()).toBe(false);
    preview.dispose(); preview.setEnabled(true); await preview.load();
    expect(loadInspectionModel).toHaveBeenCalledTimes(2); expect(preview.diagnostics.enabled).toBe(false);
  });

  it('handles late rejection after disposal and does not attach to a hero that was removed during load', async () => {
    const first = heroFixture(), rejected = deferred<InspectionModel>(), late = deferred<InspectionModel>();
    const sword = equipmentFixture(first.scene, 'sword');
    vi.mocked(loadInspectionModel).mockReturnValueOnce(late.promise).mockReturnValueOnce(rejected.promise);
    const loading = first.preview.load(); first.preview.dispose(); late.resolve(sword.model); rejected.reject(new Error('cancelled'));
    await expect(loading).resolves.toBeUndefined(); expect(sword.dispose).toHaveBeenCalledTimes(1);
    expect(first.preview.diagnostics.status).toBe('disposed');
    const second = heroFixture(), asset = equipmentFixture(second.scene, 'sword'), delayed = deferred<InspectionModel>();
    vi.mocked(loadInspectionModel).mockReturnValueOnce(delayed.promise).mockRejectedValueOnce(new Error('shield unavailable'));
    const pending = second.preview.load(); second.hero.dispose(); delayed.resolve(asset.model); await pending;
    expect(second.preview.diagnostics.status).toBe('error'); expect(asset.dispose).toHaveBeenCalledTimes(1);
    expect(second.preview.models).toEqual([]);
  });

  it('rejects a hero from another scene without creating sockets or loading assets', async () => {
    const { scene, hero } = heroFixture(), otherScene = new Scene(scene.getEngine());
    const preview = new RuenEquipmentPreview(otherScene, hero); await preview.load();
    expect(preview.diagnostics.status).toBe('error'); expect(loadInspectionModel).not.toHaveBeenCalled();
    expect(otherScene.transformNodes).toEqual([]); expect(hero.root.isDisposed()).toBe(false);
  });
});
