import { afterEach, describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { AssetContainer } from '@babylonjs/core/assetContainer';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Animation } from '@babylonjs/core/Animations/animation';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { Simulation } from '../../src/core/Simulation';
import type { CharacterRig } from '../../src/assets/characters';
import { loadInspectionModel, instantiateInspectionModel, type InspectionModel } from '../../src/assets/inspectModel';
import { RuenEquipmentPreview, type RuenEquipmentDiagnostics } from '../../src/assets/RuenEquipmentPreview';
import { createRuenEquippedLocomotion } from '../../src/assets/ruenEquippedLocomotion';
import { RuenLocomotionView, ruenMeshyProfile } from '../../src/assets/RuenLocomotionView';
import { ruenRuntimeEquipmentProfiles } from '../../src/assets/ruenEquipmentProfile';

vi.mock('../../src/assets/inspectModel', async importOriginal => ({
  ...await importOriginal<typeof import('../../src/assets/inspectModel')>(),
  loadInspectionModel: vi.fn(),
}));
vi.mock('../../src/assets/ruenEquippedLocomotion', () => ({ createRuenEquippedLocomotion: vi.fn() }));
vi.mock('../../src/assets/RuenEquipmentPreview', () => ({ RuenEquipmentPreview: vi.fn() }));

const engines: NullEngine[] = [];
function fixture(options: { names?: string[]; equipmentStatus?: RuenEquipmentDiagnostics['status'] } = {}) {
  const engine = new NullEngine(); engines.push(engine);
  const scene = new Scene(engine);
  const fallback: CharacterRig = { root: new TransformNode('existing-rig', scene), parts: {}, update: vi.fn() };
  const container = new AssetContainer(scene);
  const conversion = new TransformNode('gltf-conversion', scene); conversion.scaling.z = -1;
  const joint = new TransformNode('joint', scene); joint.parent = conversion;
  joint.rotationQuaternion = Quaternion.RotationYawPitchRoll(0.1, 0.2, 0.3);
  joint.scaling.set(0.9, 1.1, 1);
  const hand = new TransformNode('hand', scene); hand.parent = joint; hand.rotationQuaternion = Quaternion.Identity();
  const rest = { rotation: joint.rotationQuaternion.clone(), scale: joint.scaling.clone() };
  const mesh = new Mesh('skin', scene); mesh.parent = joint; container.meshes.push(mesh);
  container.transformNodes.push(conversion, joint, hand);
  for (const name of options.names ?? ['Walking', 'Running', 'Attack', 'Combat_Stance']) {
    const group = new AnimationGroup(name, scene);
    const animation = new Animation(name, 'position.y', 60, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
    animation.setKeys([{ frame: 0, value: 0.5 }, { frame: name === 'Walking' ? 62 : 38, value: 0.6 }]);
    group.addTargetedAnimation(animation, joint); container.animationGroups.push(group);
  }
  container.removeAllFromScene();
  const model = instantiateInspectionModel(container, scene);
  const equipmentRoot = new TransformNode('equipment-root', scene); equipmentRoot.parent = hand;
  const gearMesh = new Mesh('equipment-mesh', scene); gearMesh.parent = equipmentRoot;
  const equipmentState: RuenEquipmentDiagnostics = { status: options.equipmentStatus ?? 'ready', enabled: false, items: [] };
  const gear = {
    diagnostics: equipmentState,
    models: [{ kind: 'shield', mount: equipmentRoot, model: { container: { meshes: [gearMesh] } } }],
    load: vi.fn(async () => {}),
    setEnabled: vi.fn((enabled: boolean) => { equipmentState.enabled = enabled; equipmentRoot.setEnabled(enabled); }),
    dispose: vi.fn(() => { equipmentState.status = 'disposed'; equipmentRoot.dispose(); }),
  };
  vi.mocked(RuenEquipmentPreview).mockImplementationOnce(function () { return gear as unknown as RuenEquipmentPreview; });
  const groups: Partial<Record<'idle' | 'walk' | 'run', AnimationGroup>> = {};
  vi.mocked(createRuenEquippedLocomotion).mockImplementationOnce((_model, _scene, equipped = true) => {
    for (const kind of ['idle', 'walk', 'run'] as const) {
      const title = kind[0]!.toUpperCase() + kind.slice(1);
      const group = new AnimationGroup(`Ruen_${title}_${equipped ? 'Equipped' : 'Unarmed'}`, scene);
      const end = kind === 'idle' ? 120 : kind === 'walk' ? 62 : 38;
      const fps = kind === 'idle' ? 30 : 60;
      const add = (target: TransformNode, property: string, type: number, keys: { frame: number; value: number | Quaternion | Vector3 }[]) => {
        const animation = new Animation(`${group.name}:${property}`, property, fps, type, Animation.ANIMATIONLOOPMODE_CYCLE);
        animation.setKeys(keys); group.addTargetedAnimation(animation, target);
      };
      add(joint, 'position.y', Animation.ANIMATIONTYPE_FLOAT, [{ frame: 0, value: kind === 'idle' ? 0 : 0.5 }, { frame: end, value: kind === 'idle' ? 0 : 0.6 }]);
      add(joint, 'position.x', Animation.ANIMATIONTYPE_FLOAT, [{ frame: 0, value: 0 }, { frame: end / 2, value: kind === 'idle' ? 0.02 : 0 }, { frame: end, value: 0 }]);
      const rotation = kind === 'idle' ? rest.rotation : Quaternion.RotationYawPitchRoll(0, 0.8, 0);
      add(joint, 'rotationQuaternion', Animation.ANIMATIONTYPE_QUATERNION, [{ frame: 0, value: rotation.clone() }, { frame: end, value: rotation.clone() }]);
      const scale = kind === 'idle' ? rest.scale : Vector3.One();
      add(joint, 'scaling', Animation.ANIMATIONTYPE_VECTOR3, [{ frame: 0, value: scale.clone() }, { frame: end, value: scale.clone() }]);
      const grip = equipped ? Quaternion.RotationAxis(Vector3.Right(), 0.7) : Quaternion.Identity();
      add(hand, 'rotationQuaternion', Animation.ANIMATIONTYPE_QUATERNION, [{ frame: 0, value: grip.clone() }, { frame: end, value: grip.clone() }]);
      groups[kind] = group;
    }
    return groups as Record<'idle' | 'walk' | 'run', AnimationGroup>;
  });
  vi.mocked(loadInspectionModel).mockResolvedValueOnce(model);
  const view = new RuenLocomotionView(scene, fallback);
  const sim = new Simulation();
  const advance = (seconds: number, z: number, x = 0) => {
    sim.age += seconds; sim.player.z += z; sim.player.x += x; view.update(sim, true);
  };
  return { scene, fallback, container, conversion, joint, hand, mesh, model, gear, gearMesh, groups, rest, view, sim, advance };
}

afterEach(() => {
  for (const engine of engines.splice(0)) engine.dispose();
  vi.restoreAllMocks(); vi.resetAllMocks();
});

const equipped = (kind: 'Idle' | 'Walk' | 'Run') => `Ruen_${kind}_Equipped`;

describe('equipped Meshy locomotion visual adapter', () => {
  it('loads runtime equipment and authored clips before exterior scaling, preserving original groups', async () => {
    const { view, model, conversion, joint, fallback, gear, container } = fixture();
    const originalGroups = [...container.animationGroups];
    const originalKeys = originalGroups.map(group => group.targetedAnimations[0]!.animation.getKeys());
    fallback.root.rotation.x = 1.4;
    gear.load.mockImplementation(async () => { expect(model.root.scaling.asArray()).toEqual([1, 1, 1]); });
    await view.load();
    expect(view.status).toBe('ready'); expect(view.diagnostics.equipped).toBe(true);
    expect(RuenEquipmentPreview).toHaveBeenCalledWith(view.model!.root.getScene(), model, ruenRuntimeEquipmentProfiles);
    expect(gear.load).toHaveBeenCalledOnce(); expect(view.equipment).toBe(gear);
    expect(model.root.name).toBe('ruen-meshy-visual'); expect(model.root.parent).toBeNull();
    expect(model.root.scaling.asArray()).toEqual(Array(3).fill(1.45 / 1.70));
    expect(conversion.parent).toBe(model.root); expect(conversion.scaling.z).toBe(-1);
    expect(joint.parent).toBe(conversion); expect(fallback.root.rotation.x).toBe(1.4);
    expect(model.root.isEnabled()).toBe(false); expect(fallback.root.isEnabled()).toBe(true);
    expect(gear.diagnostics.enabled).toBe(false);
    expect(model.container.animationGroups.every(group => !group.isStarted)).toBe(true);
    originalGroups.forEach((group, index) => expect(group.targetedAnimations[0]!.animation.getKeys()).toEqual(originalKeys[index]));
    expect(container.animationGroups.slice(0, 4)).toEqual(originalGroups);
    expect(container.animationGroups).toHaveLength(7); expect(model.report.animationGroups).toHaveLength(4);
  });

  it('opens in a paused equipped Idle and advances breathing only while the simulation plays', async () => {
    const { view, model, scene, sim, joint, hand, mesh, gearMesh, fallback, conversion, gear, advance } = fixture();
    const before = structuredClone(sim.player);
    await view.load(); view.update(sim, false); scene._animate(0);
    expect(view.diagnostics.reason).toBe('paused'); expect(view.diagnostics.representation).toBe('meshy');
    expect(model.root.isEnabled()).toBe(true); expect(fallback.root.isEnabled()).toBe(false);
    expect(view.activeClip).toBe(equipped('Idle')); expect(view.weights).toEqual({ idle: 1, walk: 0, run: 0 });
    expect(view.diagnostics.clips.filter(group => group.isStarted).map(group => group.name)).toEqual([equipped('Idle')]);
    expect(view.diagnostics.clips.every(group => !group.isPlaying)).toBe(true); expect(gear.diagnostics.enabled).toBe(true);
    expect(hand.rotationQuaternion!.equalsWithEpsilon(Quaternion.RotationAxis(Vector3.Right(), 0.7))).toBe(true);
    expect(joint.position.y).toBeCloseTo(0, 10); expect(conversion.scaling.z).toBe(-1); expect(sim.player).toEqual(before);
    const paused = joint.position.clone(); scene._animate(1000); expect(joint.position.equals(paused)).toBe(true);
    advance(0.1, 0); scene._animate(0); advance(0.1, 0); scene._animate(100);
    expect(joint.position.x).toBeGreaterThan(0); expect(joint.position.y).toBeCloseTo(0, 10);
    expect(view.diagnostics.reason).toBe('idle-animation');
    sim.age = 0.02; sim.player.invulnerable = 1; view.update(sim, true);
    expect(mesh.visibility).toBe(0.4); expect(gearMesh.visibility).toBe(0.4);
    sim.player.invulnerable = 0; view.update(sim, true); expect(mesh.visibility).toBe(1); expect(gearMesh.visibility).toBe(1);
  });

  it('blends a running pose to breathing Idle, restores legs, and freezes the transition in pause', async () => {
    const { view, scene, sim, joint, rest, groups, advance } = fixture();
    await view.load(); sim.player.state = 'run'; view.update(sim, true); scene._animate(0);
    advance(0.1, 0.4); scene._animate(100); const runningY = joint.position.y;
    expect(runningY).toBeGreaterThan(0);
    sim.player.state = 'idle'; view.update(sim, true); scene._animate(0);
    expect(view.weights).toEqual({ idle: 0, walk: 0, run: 1 }); expect(joint.position.y).toBeCloseTo(runningY);
    advance(0.1, 0); scene._animate(100);
    expect(view.weights).toEqual({ idle: 0.5, walk: 0, run: 0.5 });
    expect(joint.position.y).toBeCloseTo(runningY / 2);
    const pausedY = joint.position.y, pausedFrame = groups.idle!.getCurrentFrame();
    sim.age += 0.1; view.update(sim, false); scene._animate(100);
    expect(joint.position.y).toBe(pausedY); expect(groups.idle!.getCurrentFrame()).toBe(pausedFrame);
    expect(view.diagnostics.reason).toBe('paused');
    advance(0.1, 0); scene._animate(100);
    expect(view.weights).toEqual({ idle: 1, walk: 0, run: 0 }); expect(joint.position.y).toBeCloseTo(0, 10);
    expect(joint.rotationQuaternion!.equalsWithEpsilon(rest.rotation)).toBe(true);
    expect(joint.scaling.equalsWithEpsilon(rest.scale)).toBe(true);
    expect(groups.run!.isStarted).toBe(false); expect(groups.idle!.isPlaying).toBe(true);
    advance(0.25, 0); scene._animate(250); expect(joint.position.y).toBeCloseTo(0, 10);
    expect(joint.position.x).toBeGreaterThan(0);
  });

  it('interrupts three-way blends continuously and keeps complementary weights', async () => {
    const { view, scene, sim, joint, groups, advance } = fixture();
    await view.load(); view.update(sim, true); scene._animate(0);
    sim.player.state = 'walk'; advance(0.05, 0.06); scene._animate(0);
    expect(view.weights.walk).toBeGreaterThan(0); expect(view.weights.idle).toBeGreaterThan(0);
    const before = joint.position.y, weights = view.weights;
    sim.player.state = 'run'; view.update(sim, true); scene._animate(0);
    expect(view.weights).toEqual(weights); expect(joint.position.y).toBeCloseTo(before);
    advance(0.05, 0.2); scene._animate(50);
    expect(Object.values(view.weights).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
    expect(view.weights.idle).toBeGreaterThan(0); expect(view.weights.walk).toBeGreaterThan(0); expect(view.weights.run).toBeGreaterThan(0);
    advance(0.1, 0.4); advance(0.05, 0.2); scene._animate(150);
    expect(view.weights).toEqual({ idle: 0, walk: 0, run: 1 });
    expect(groups.idle!.isStarted).toBe(false); expect(groups.walk!.isStarted).toBe(false); expect(groups.run!.isPlaying).toBe(true);
  });

  it('resets old poses on respawn/new game and on returning from unsupported actions', async () => {
    const { view, scene, model, sim, joint, rest, advance } = fixture();
    await view.load(); sim.player.state = 'run'; view.update(sim, true); scene._animate(0);
    advance(0.1, 0.4); scene._animate(100); expect(joint.position.y).toBeGreaterThan(0);
    sim.respawn(); view.update(sim, true); scene._animate(0);
    expect(view.weights).toEqual({ idle: 1, walk: 0, run: 0 }); expect(joint.position.y).toBeCloseTo(0, 10);
    expect(joint.rotationQuaternion!.equalsWithEpsilon(rest.rotation)).toBe(true);
    sim.player.state = 'run'; advance(0.1, 0.4); scene._animate(100);
    const replacement = new Simulation(); view.update(replacement, false); scene._animate(0);
    expect(view.diagnostics.reason).toBe('paused'); expect(joint.position.y).toBeCloseTo(0, 10);
    expect(model.container.animationGroups.filter(group => group.isStarted).map(group => group.name)).toEqual([equipped('Idle')]);
    replacement.player.state = 'attack1'; view.update(replacement, true);
    joint.position.y = 0.8;
    replacement.player.state = 'idle'; view.update(replacement, true); scene._animate(0);
    expect(joint.position.y).toBeCloseTo(0, 10); expect(joint.rotationQuaternion!.equalsWithEpsilon(rest.rotation)).toBe(true);
  });

  it('uses actual displacement, keeps 120Hz no-step renders running, and freezes against walls', async () => {
    const { view, model, fallback, sim, advance } = fixture();
    await view.load(); sim.player.state = 'walk'; sim.player.vz = 99;
    view.update(sim, true); advance(0.1, 0.12);
    expect(view.actualSpeed).toBeCloseTo(1.2);
    expect(view.diagnostics.clips.find(c => c.name === equipped('Walk'))?.speedRatio).toBeCloseTo(1);
    expect(view.diagnostics.clips.filter(c => c.isPlaying).map(c => c.name)).toEqual([equipped('Walk')]);
    expect(model.root.position.z).toBe(sim.player.z); expect(fallback.root.isEnabled()).toBe(false);
    view.update(sim, true);
    expect(view.actualSpeed).toBeCloseTo(1.2); expect(view.diagnostics.clips.find(c => c.name === equipped('Walk'))?.isPlaying).toBe(true);
    advance(0.05, 0.06); expect(view.diagnostics.clips.find(c => c.name === equipped('Walk'))?.speedRatio).toBeCloseTo(1);
    advance(0.1, 0);
    expect(view.actualSpeed).toBe(0); expect(view.diagnostics.representation).toBe('meshy');
    expect(model.root.isEnabled()).toBe(true); expect(fallback.root.isEnabled()).toBe(false);
    expect(view.diagnostics.clips.every(c => !c.isPlaying)).toBe(true);
    advance(0.1, 0.12); expect(view.diagnostics.clips.find(c => c.name === equipped('Walk'))?.isPlaying).toBe(true);
  });

  it('honors the simulation-time cap in both gait and Idle and rejects an invalid clock ratio', async () => {
    const { view, sim, groups } = fixture();
    await view.load(); sim.player.state = 'run'; view.update(sim, true);
    sim.age += 0.1; sim.player.z += 0.4; view.update(sim, true, 0.1 / 0.25);
    expect(view.actualSpeed).toBeCloseTo(4);
    expect(groups.run!.speedRatio * 0.25 * ruenMeshyProfile.referenceSpeed.run).toBeCloseTo(0.4);
    expect(groups.run!.isPlaying).toBe(true);
    sim.player.state = 'idle'; sim.age += 0.1; view.update(sim, true, 0.4);
    expect(groups.idle!.speedRatio).toBe(0.4); expect(groups.idle!.isPlaying).toBe(true);
    view.update(sim, true, Number.NaN); expect(view.diagnostics.reason).toBe('paused');
    expect(view.diagnostics.clips.every(group => !group.isPlaying)).toBe(true);
  });

  it('phase-aligns walk/run crossfades and never starts the original master clips', async () => {
    const { view, container, groups, sim, advance } = fixture();
    await view.load(); sim.player.state = 'walk'; view.update(sim, true); advance(0.1, 0.12);
    const walk = groups.walk!, run = groups.run!; walk.goToFrame(31);
    sim.player.state = 'run'; advance(0.05, 0.2);
    expect(run.getCurrentFrame()).toBeCloseTo(19);
    expect(view.weights.run).toBeGreaterThan(0); expect(view.weights.run).toBeLessThan(1);
    expect(view.weights.walk + view.weights.run).toBeCloseTo(1); expect(run.speedRatio).toBeCloseTo(1);
    expect(container.animationGroups.filter(c => c.isPlaying).map(c => c.name)).toEqual([equipped('Walk'), equipped('Run')]);
    advance(0.1, 0.4); advance(0.05, 0.2);
    expect(view.weights).toEqual({ idle: 0, walk: 0, run: 1 }); expect(walk.isStarted).toBe(false);
    sim.player.state = 'walk'; advance(0.05, 0.06); sim.player.state = 'run'; advance(0.05, 0.2);
    expect(view.weights.walk + view.weights.run).toBeCloseTo(1);
    expect(container.animationGroups.slice(0, 4).every(c => !c.isStarted)).toBe(true);
  });

  it('preserves action fallbacks, hides equipment, and never changes simulation or procedural transforms', async () => {
    const { view, model, fallback, gear, sim, advance } = fixture();
    await view.load(); sim.player.state = 'run'; view.update(sim, true); advance(0.1, 0.4);
    for (const state of ['jump', 'fall', 'land', 'roll', 'attack1', 'attack2', 'attack3', 'shield', 'hurt', 'death', 'interact', 'victory'] as const) {
      sim.player.state = state; fallback.root.rotation.x = 1.3;
      const before = structuredClone(sim.player); view.update(sim, true);
      expect(sim.player).toEqual(before); expect(view.diagnostics.representation).toBe('fallback');
      expect(fallback.root.isEnabled()).toBe(true); expect(model.root.isEnabled()).toBe(false);
      expect(gear.diagnostics.enabled).toBe(false); expect(fallback.root.rotation.x).toBe(1.3);
      expect(model.container.animationGroups.every(c => !c.isStarted)).toBe(true);
    }
  });

  it('discards motion on menus, new game, respawn and teleports', async () => {
    const { view, model, sim, advance } = fixture();
    await view.load(); sim.player.state = 'run'; view.update(sim, true); advance(0.1, 0.4);
    view.update(sim, false); expect(view.actualSpeed).toBe(0); expect(view.diagnostics.reason).toBe('paused');
    expect(view.diagnostics.clips.every(c => !c.isPlaying)).toBe(true); expect(model.root.isEnabled()).toBe(true);
    advance(0.1, 0.4); expect(view.actualSpeed).toBeCloseTo(4);
    sim.respawn(); sim.player.state = 'run'; sim.age += 0.1; view.update(sim, true);
    expect(view.actualSpeed).toBe(0); expect(view.diagnostics.reason).toBe('controller-reset');
    advance(0.1, 0.4); expect(view.actualSpeed).toBeCloseTo(4);
    sim.player.z += 40; sim.age += 0.1; view.update(sim, true);
    expect(view.actualSpeed).toBe(0); expect(model.root.position.z).toBe(sim.player.z);
    const replacement = new Simulation(); replacement.player.state = 'walk'; replacement.age = sim.age + 0.1;
    view.update(replacement, true); expect(view.actualSpeed).toBe(0); expect(view.diagnostics.reason).toBe('controller-reset');
  });

  it('uses the existing rig for lock-on strafing and returns to equipped forward motion', async () => {
    const { view, gear, sim, advance } = fixture();
    await view.load(); sim.player.state = 'walk'; sim.targetId = 'sprout-1'; sim.player.yaw = 0;
    view.update(sim, true); advance(0.1, 0, 0.12);
    expect(view.diagnostics.reason).toBe('unsupported-direction'); expect(view.diagnostics.representation).toBe('fallback');
    expect(gear.diagnostics.enabled).toBe(false); view.update(sim, true); expect(view.diagnostics.reason).toBe('unsupported-direction');
    view.update(sim, false); expect(view.diagnostics.representation).toBe('fallback');
    advance(0.1, 0.12);
    expect(view.diagnostics.representation).toBe('meshy'); expect(view.activeClip).toBe(equipped('Walk')); expect(gear.diagnostics.enabled).toBe(true);
  });

  it.each(['partial', 'error'] as const)('retains a breathing unarmed hero when equipment reports %s', async equipmentStatus => {
    const { view, sim, gear, model, hand, scene, advance } = fixture({ equipmentStatus });
    await view.load(); view.update(sim, false); scene._animate(0);
    expect(view.status).toBe('ready'); expect(view.error).toBeUndefined(); expect(view.model).toBe(model);
    expect(view.diagnostics.equipped).toBe(false); expect(view.diagnostics.equipment?.status).toBe(equipmentStatus);
    expect(gear.diagnostics.enabled).toBe(false); expect(view.activeClip).toBe('Ruen_Idle_Unarmed');
    expect(hand.rotationQuaternion!.equalsWithEpsilon(Quaternion.Identity())).toBe(true);
    sim.player.state = 'run'; advance(0.1, 0.4); expect(view.activeClip).toBe('Ruen_Run_Unarmed');
    expect(gear.diagnostics.enabled).toBe(false); expect(view.diagnostics.representation).toBe('meshy');
  });

  it('keeps the procedural fallback after a missing source clip or hero network failure', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const missing = fixture({ names: ['Walking', 'Attack'] }); await missing.view.load();
    expect(missing.view.status).toBe('error'); expect(missing.view.error).toContain('Running');
    expect(missing.model.root.isDisposed()).toBe(true); expect(missing.fallback.root.isEnabled()).toBe(true);
    const failed = fixture(); vi.mocked(loadInspectionModel).mockReset().mockRejectedValueOnce(new Error('network unavailable'));
    await failed.view.load(); expect(failed.view.status).toBe('error'); expect(failed.view.error).toBe('network unavailable');
    expect(failed.view.model).toBeUndefined(); expect(failed.fallback.root.isEnabled()).toBe(true); expect(warn).toHaveBeenCalledTimes(2);
  });

  it('disposes equipment before its hero, without owning the existing rig', async () => {
    const { view, gear, model, fallback } = fixture(); await view.load();
    gear.dispose.mockImplementation(() => { expect(model.root.isDisposed()).toBe(false); });
    view.dispose(); view.dispose();
    expect(gear.dispose).toHaveBeenCalledOnce(); expect(model.root.isDisposed()).toBe(true);
    expect(fallback.root.isDisposed()).toBe(false); expect(fallback.root.isEnabled()).toBe(true);
    expect(view.equipment).toBeUndefined(); expect(view.model).toBeUndefined();
  });

  it('disposes a late hero load and concurrent load calls share one request', async () => {
    const { view, fallback, model } = fixture();
    let resolve!: (model: InspectionModel) => void;
    vi.mocked(loadInspectionModel).mockReset().mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const loading = view.load(), duplicate = view.load(); view.dispose(); resolve(model); await Promise.all([loading, duplicate]);
    expect(loadInspectionModel).toHaveBeenCalledOnce(); expect(model.root.isDisposed()).toBe(true);
    expect(fallback.root.isDisposed()).toBe(false); expect(fallback.root.isEnabled()).toBe(true); expect(view.model).toBeUndefined();
    expect(RuenEquipmentPreview).not.toHaveBeenCalled();
  });

  it('cleans a late equipment load without starting authored groups after disposal', async () => {
    const { view, gear, model, fallback } = fixture();
    let resolve!: () => void;
    gear.load.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
    const loading = view.load(); await Promise.resolve();
    expect(gear.load).toHaveBeenCalledOnce(); view.dispose();
    expect(model.root.isDisposed()).toBe(true);
    resolve(); await loading;
    expect(model.root.isDisposed()).toBe(true); expect(createRuenEquippedLocomotion).not.toHaveBeenCalled();
    expect(gear.dispose).toHaveBeenCalled(); expect(fallback.root.isDisposed()).toBe(false);
  });
});
