import { afterEach, describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { AssetContainer } from '@babylonjs/core/assetContainer';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Animation } from '@babylonjs/core/Animations/animation';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { Simulation, type GameEvent } from '../../src/core/Simulation';
import type { CharacterRig } from '../../src/assets/characters';
import { loadInspectionModel, instantiateInspectionModel, type InspectionModel } from '../../src/assets/inspectModel';
import { RuenEquipmentPreview, type RuenEquipmentDiagnostics } from '../../src/assets/RuenEquipmentPreview';
import { createRuenEquippedLocomotion } from '../../src/assets/ruenEquippedLocomotion';
import { createRuenEquippedCombat, ruenEquippedCombatProfile } from '../../src/assets/ruenEquippedCombat';
import { attacks } from '../../src/player/combat';
import { createRuenEquippedTraversal, ruenEquippedTraversalProfile } from '../../src/assets/ruenEquippedTraversal';
import { gameConfig } from '../../src/config/gameConfig';
import { RuenLocomotionView, ruenMeshyProfile } from '../../src/assets/RuenLocomotionView';
import { ruenRuntimeEquipmentProfiles } from '../../src/assets/ruenEquipmentProfile';

vi.mock('../../src/assets/inspectModel', async importOriginal => ({
  ...await importOriginal<typeof import('../../src/assets/inspectModel')>(),
  loadInspectionModel: vi.fn(),
}));
vi.mock('../../src/assets/ruenEquippedLocomotion', () => ({ createRuenEquippedLocomotion: vi.fn() }));
vi.mock('../../src/assets/ruenEquippedCombat', async importOriginal => ({
  ...await importOriginal<typeof import('../../src/assets/ruenEquippedCombat')>(), createRuenEquippedCombat: vi.fn(),
}));
vi.mock('../../src/assets/ruenEquippedTraversal', async importOriginal => ({
  ...await importOriginal<typeof import('../../src/assets/ruenEquippedTraversal')>(), createRuenEquippedTraversal: vi.fn(),
}));
vi.mock('../../src/assets/RuenEquipmentPreview', () => ({ RuenEquipmentPreview: vi.fn() }));

const engines: NullEngine[] = [];
function fixture(options: { names?: string[]; equipmentStatus?: RuenEquipmentDiagnostics['status']; directionalRig?: boolean } = {}) {
  const engine = new NullEngine(); engines.push(engine);
  const scene = new Scene(engine);
  const fallback: CharacterRig = { root: new TransformNode('existing-rig', scene), parts: {}, update: vi.fn() };
  const container = new AssetContainer(scene);
  const conversion = new TransformNode('gltf-conversion', scene); conversion.scaling.z = -1;
  const joint = new TransformNode('mixamorig:Hips', scene); joint.parent = conversion;
  joint.rotationQuaternion = Quaternion.RotationYawPitchRoll(0.1, 0.2, 0.3);
  joint.scaling.set(0.9, 1.1, 1);
  if (options.directionalRig) { joint.rotationQuaternion = Quaternion.Identity(); joint.scaling.setAll(1); }
  const spine = new TransformNode('mixamorig:Spine', scene); spine.parent = joint; spine.position.y = 0.4; spine.rotationQuaternion = Quaternion.Identity();
  const leg = new TransformNode('mixamorig:LeftUpLeg', scene); leg.parent = joint; leg.rotationQuaternion = Quaternion.Identity();
  const hand = new TransformNode('hand', scene); hand.parent = spine; hand.rotationQuaternion = Quaternion.Identity();
  const rest = { rotation: joint.rotationQuaternion.clone(), scale: joint.scaling.clone() };
  const mesh = new Mesh('skin', scene); mesh.parent = joint; container.meshes.push(mesh);
  container.transformNodes.push(conversion, joint, spine, leg, hand);
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
      add(spine, 'position', Animation.ANIMATIONTYPE_VECTOR3, [{ frame: 0, value: spine.position.clone() }, { frame: end, value: spine.position.clone() }]);
      add(spine, 'rotationQuaternion', Animation.ANIMATIONTYPE_QUATERNION, [{ frame: 0, value: Quaternion.Identity() }, { frame: end, value: Quaternion.Identity() }]);
      add(leg, 'rotationQuaternion', Animation.ANIMATIONTYPE_QUATERNION, [{ frame: 0, value: Quaternion.Identity() }, { frame: end / 2, value: Quaternion.RotationAxis(Vector3.Right(), kind === 'idle' ? 0 : 0.5) }, { frame: end, value: Quaternion.Identity() }]);
      groups[kind] = group;
    }
    return groups as Record<'idle' | 'walk' | 'run', AnimationGroup>;
  });
  const combatGroups: Partial<ReturnType<typeof createRuenEquippedCombat>> = {};
  vi.mocked(createRuenEquippedCombat).mockImplementationOnce((_model, _scene, locomotion) => {
    expect(model.root.scaling.asArray()).toEqual([1, 1, 1]);
    for (const kind of ['shield', 'block', 'attack1', 'attack2', 'attack3'] as const) {
      const group = new AnimationGroup(ruenEquippedCombatProfile.names[kind], scene);
      const isAttack = kind.startsWith('attack');
      const duration = isAttack ? attacks[Number(kind.slice(-1)) - 1]!.duration : kind === 'block' ? 0.22 : 4;
      for (const { target, animation } of locomotion.idle.targetedAnimations) {
        const clone = animation.clone(true); clone.framePerSecond = 60;
        let value = animation.getKeys()[0]!.value;
        if (target === hand) value = Quaternion.RotationAxis(Vector3.Right(), isAttack ? 1.4 : 1.2);
        const peak = isAttack && target === joint && animation.targetProperty === 'position.y' ? 0.2 : value;
        clone.setKeys([{ frame: 0, value }, { frame: duration * 30, value: peak }, { frame: duration * 60, value }]);
        group.addTargetedAnimation(clone, target);
      }
      combatGroups[kind] = group;
    }
    return combatGroups as ReturnType<typeof createRuenEquippedCombat>;
  });
  const traversalGroups: Partial<ReturnType<typeof createRuenEquippedTraversal>> = {};
  vi.mocked(createRuenEquippedTraversal).mockImplementationOnce((_model, _scene, locomotion) => {
    expect(model.root.scaling.asArray()).toEqual([1, 1, 1]);
    for (const kind of ['jump', 'fall', 'land', 'roll'] as const) {
      const group = new AnimationGroup(`Ruen_${kind[0]!.toUpperCase() + kind.slice(1)}_Equipped`, scene);
      const duration = ruenEquippedTraversalProfile.duration[kind];
      for (const { target, animation } of locomotion.idle.targetedAnimations) {
        const clone = animation.clone(true); clone.framePerSecond = 60;
        const value = target === hand ? Quaternion.RotationAxis(Vector3.Right(), 1.1) : animation.getKeys()[0]!.value;
        const peak = target === joint && animation.targetProperty === 'position.y' ? -0.2 :
          target === leg ? Quaternion.RotationAxis(Vector3.Right(), 0.6) : value;
        clone.setKeys([{ frame: 0, value }, { frame: duration * 30, value: peak }, { frame: duration * 60, value }]);
        if (kind === 'roll' && target === joint && animation.targetProperty === 'rotationQuaternion') {
          clone.setKeys([0, 0.25, 0.5, 0.75, 1].map(phase => ({ frame: duration * 60 * phase, value: Quaternion.RotationAxis(Vector3.Right(), Math.PI * 2 * phase) })));
        }
        group.addTargetedAnimation(clone, target);
      }
      traversalGroups[kind] = group;
    }
    return traversalGroups as ReturnType<typeof createRuenEquippedTraversal>;
  });
  vi.mocked(loadInspectionModel).mockResolvedValueOnce(model);
  const view = new RuenLocomotionView(scene, fallback);
  const sim = new Simulation();
  const advance = (seconds: number, z: number, x = 0) => {
    sim.age += seconds; sim.player.z += z; sim.player.x += x; view.update(sim, true);
  };
  return { scene, fallback, container, conversion, joint, spine, leg, hand, mesh, model, gear, gearMesh, groups, combatGroups, traversalGroups, rest, view, sim, advance };
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
    expect(container.animationGroups).toHaveLength(16); expect(model.report.animationGroups).toHaveLength(4);
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
    for (const state of ['jump', 'fall', 'attack1', 'attack2', 'attack3', 'shield', 'hurt', 'death', 'interact', 'victory'] as const) {
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


describe('equipped Meshy combat visual adapter', () => {
  function attack(sim: Simulation, combo: 1 | 2 | 3, time: number): void {
    sim.player.state = `attack${combo}`; sim.player.combo = combo;
    sim.player.attackTime = time; sim.player.shield = false;
  }
  function guard(sim: Simulation): void {
    sim.player.state = 'shield'; sim.player.shield = true; sim.player.attackTime = -1;
  }

  it.each([1, 2, 3] as const)('samples attack %s at exact controller windows without wall-clock, movement or playback-rate drift', async combo => {
    const { view, sim, scene, combatGroups, joint, gear, model } = fixture();
    await view.load(); view.update(sim, true); scene._animate(0);
    const timing = attacks[combo - 1]!;
    for (const time of [1 / 60, timing.windup - 0.0001, timing.windup, timing.activeEnd, timing.duration - 0.001]) {
      attack(sim, combo, time); sim.age += 0.03; sim.player.stateTime = 200; sim.player.queued = true;
      const before = structuredClone(sim.player); view.update(sim, true, 0.01); scene._animate(250);
      expect(view.diagnostics.representation).toBe('meshy'); expect(gear.diagnostics.enabled).toBe(true);
      expect(view.weights).toEqual({ idle: 0, walk: 0, run: 0 }); expect(view.actualSpeed).toBe(0);
      expect(view.diagnostics.combat.state).toBe(`attack${combo}`);
      expect(view.diagnostics.combat.frame).toBeCloseTo(time * 60, 8);
      expect(view.diagnostics.combat.phase).toBe(time < timing.windup ? 'windup' : time < timing.activeEnd ? 'active' : 'recovery');
      if (time >= 0.06) expect(view.diagnostics.combat.entryWeight).toBe(1);
      else { expect(view.diagnostics.combat.entryWeight).toBeGreaterThan(0); expect(view.diagnostics.combat.entryWeight).toBeLessThan(1); }
      const group = combatGroups[`attack${combo}`]!;
      expect(group.getCurrentFrame()).toBeCloseTo(time * 60, 8); expect(group.isPlaying).toBe(false); expect(group.weight).toBe(1);
      const pose = joint.position.clone(); view.update(sim, false); scene._animate(2000);
      expect(joint.position.equalsWithEpsilon(pose)).toBe(true); expect(group.getCurrentFrame()).toBeCloseTo(time * 60, 8);
      expect(view.diagnostics.reason).toBe('paused'); expect(sim.player).toEqual(before);
      expect(model.container.animationGroups.slice(0, 4).every(original => !original.isStarted)).toBe(true);
    }
  });

  it('keeps queued recovery, switches only on the controller combo, and restarts a repeated attack when its timer rewinds', async () => {
    const { view, sim, scene, combatGroups, joint } = fixture();
    await view.load(); view.update(sim, true); scene._animate(0);
    attack(sim, 1, 0.43); sim.player.queued = true; sim.age += 0.1; view.update(sim, true); scene._animate(0);
    expect(view.diagnostics.combat.state).toBe('attack1'); expect(view.diagnostics.combat.phase).toBe('recovery');
    const recovery = joint.position.clone();
    attack(sim, 2, 0); sim.age += 1 / 60; view.update(sim, true); scene._animate(0);
    expect(view.diagnostics.combat.state).toBe('attack2'); expect(view.diagnostics.combat.frame).toBe(0);
    expect(view.diagnostics.combat.entryWeight).toBe(0); expect(joint.position.equalsWithEpsilon(recovery)).toBe(true);
    expect(combatGroups.attack1!.isStarted).toBe(false);
    attack(sim, 2, attacks[1].windup); sim.age += 0.1; view.update(sim, true); scene._animate(0);
    expect(view.diagnostics.combat.entryWeight).toBe(1); expect(view.diagnostics.combat.phase).toBe('active');
    const active = joint.position.clone();
    attack(sim, 2, 0); sim.age += 1 / 60; view.update(sim, true); scene._animate(0);
    expect(view.diagnostics.combat.entryWeight).toBe(0); expect(joint.position.equalsWithEpsilon(active)).toBe(true);
  });

  it('fades the last combat pose into Idle and freezes that exit while paused', async () => {
    const { view, sim, scene, joint, groups, combatGroups } = fixture();
    await view.load(); view.update(sim, true); scene._animate(0);
    attack(sim, 1, 0.24); sim.age += 0.1; view.update(sim, true); scene._animate(0);
    const lastY = joint.position.y; expect(lastY).toBeGreaterThan(0);
    sim.player.state = 'idle'; sim.player.attackTime = -1; view.update(sim, true); scene._animate(0);
    expect(view.diagnostics.combat.state).toBeNull(); expect(combatGroups.attack1!.isStarted).toBe(false);
    expect(joint.position.y).toBeCloseTo(lastY, 8); expect(groups.idle!.weight).toBe(0);
    sim.age += 0.05; view.update(sim, true); scene._animate(50);
    expect(groups.idle!.weight).toBeCloseTo(0.5, 8); expect(joint.position.y).toBeCloseTo(lastY / 2, 8);
    view.update(sim, false); scene._animate(1000); expect(joint.position.y).toBeCloseTo(lastY / 2, 8);
    sim.age += 0.05; view.update(sim, true); scene._animate(50);
    expect(groups.idle!.weight).toBe(1); expect(joint.position.y).toBeCloseTo(0, 8);
  });

  it('timestamps block recoil from the single shield event and never replays duplicate or companion events', async () => {
    const { view, sim, scene } = fixture();
    await view.load(); view.update(sim, true); guard(sim); sim.age += 0.1; view.update(sim, true);
    const event: GameEvent = { type: 'shield' };
    sim.age += 0.03; view.handleEvent(event, sim); sim.age += 0.04; view.update(sim, true); scene._animate(1000);
    expect(view.diagnostics.combat.state).toBe('block'); expect(view.diagnostics.combat.time).toBeCloseTo(0.04);
    expect(view.diagnostics.combat.frame).toBeCloseTo(2.4);
    view.update(sim, false); scene._animate(1000); expect(view.diagnostics.combat.frame).toBeCloseTo(2.4);
    sim.age += 0.04; view.handleEvent(event, sim); view.handleEvent({ type: 'guardian-block' }, sim); view.update(sim, true);
    expect(view.diagnostics.combat.time).toBeCloseTo(0.08);
    sim.age += 0.2; view.update(sim, true); expect(view.diagnostics.combat.state).toBe('shield');
    view.handleEvent(event, sim); view.update(sim, true); expect(view.diagnostics.combat.state).toBe('shield');
    // Hurt may happen on an intervening fixed step without rendering that state.
    view.handleEvent({ type: 'shield' }, sim); view.handleEvent({ type: 'hurt' }, sim);
    view.update(sim, true); expect(view.diagnostics.combat.state).toBe('shield');
  });

  it('discards blocked events after interruption, release, airborne states and respawn', async () => {
    const { view, sim, scene } = fixture(); await view.load(); view.update(sim, true);
    for (const interrupt of ['hurt', 'roll', 'jump', 'idle'] as const) {
      guard(sim); sim.age += 0.1; view.update(sim, true);
      const event: GameEvent = { type: 'shield' }; view.handleEvent(event, sim);
      sim.player.state = interrupt; sim.player.shield = interrupt === 'jump'; sim.player.grounded = interrupt !== 'jump';
      view.update(sim, true); scene._animate(0);
      expect(view.diagnostics.combat.state).toBeNull();
      sim.player.grounded = true; guard(sim); view.handleEvent(event, sim); sim.age += 0.01; view.update(sim, true);
      expect(view.diagnostics.combat.state).toBe('shield');
    }
    const stale: GameEvent = { type: 'shield' }; sim.player.state = 'hurt'; view.handleEvent(stale, sim);
    guard(sim); view.handleEvent(stale, sim); view.update(sim, true); expect(view.diagnostics.combat.state).toBe('shield');
    view.handleEvent({ type: 'shield' }, sim); sim.respawn(); view.update(sim, true);
    expect(view.diagnostics.combat.state).toBeNull(); guard(sim); sim.age += 0.01; view.update(sim, true);
    expect(view.diagnostics.combat.state).toBe('shield');
    view.handleEvent({ type: 'shield' }, sim); sim.player.z += 40; sim.age += 0.1; view.update(sim, true);
    expect(view.diagnostics.combat.state).toBe('shield'); expect(view.diagnostics.combat.guardFrame).toBe(0);
  });

  it.each([[0, 1, 0], [0, 0, -1], [Math.PI / 3, 1, 0]] as const)('steps in guard at yaw %s along x/z %s/%s while keeping the upper guard facing the controller', async (yaw, right, forward) => {
    const { view, sim, scene, joint, spine, leg, model, combatGroups, groups } = fixture({ directionalRig: true });
    await view.load(); sim.player.yaw = yaw; sim.targetId = 'sprout-1'; view.update(sim, true);
    guard(sim); sim.age += 0.1; view.update(sim, true); scene._animate(0);
    const upper = spine.computeWorldMatrix(true).clone(); const restLeg = leg.rotationQuaternion!.clone();
    const before = structuredClone(sim.player); const dx = (right * Math.cos(yaw) + forward * Math.sin(yaw)) * 0.16;
    const dz = (-right * Math.sin(yaw) + forward * Math.cos(yaw)) * 0.16;
    for (let i = 0; i < 3; i++) { sim.age += 0.1; sim.player.x += dx; sim.player.z += dz; view.update(sim, true); scene._animate(100); }
    expect(view.diagnostics.representation).toBe('meshy'); expect(view.diagnostics.combat.state).toBe('shield');
    expect(view.diagnostics.combat.guardMoving).toBe(true); expect(view.diagnostics.combat.guardFrame).toBeGreaterThan(0);
    expect(Math.abs(view.diagnostics.combat.guardDirection)).toBeLessThanOrEqual(Math.PI / 2 + 0.001);
    expect(leg.rotationQuaternion!.equalsWithEpsilon(restLeg)).toBe(false);
    expect(sim.player.yaw).toBe(before.yaw); expect(model.root.position.x).toBe(sim.player.x); expect(model.root.position.z).toBe(sim.player.z);
    const facing = spine.computeWorldMatrix(true);
    for (const index of [0, 1, 2, 4, 5, 6, 8, 9, 10]) expect(facing.m[index]).toBeCloseTo(upper.m[index]!, 5);
    expect(combatGroups.shield!.isPlaying).toBe(false); expect(groups.walk!.weight).toBe(0);
    const frame = view.diagnostics.combat.guardFrame, legPose = leg.rotationQuaternion!.clone(), rootPose = joint.position.clone();
    view.update(sim, false); scene._animate(1000);
    expect(view.diagnostics.combat.guardFrame).toBe(frame); expect(leg.rotationQuaternion!.equalsWithEpsilon(legPose)).toBe(true);
    expect(joint.position.equalsWithEpsilon(rootPose)).toBe(true);
    sim.age += 0.2; view.update(sim, true); scene._animate(200);
    expect(view.diagnostics.combat.guardMoving).toBe(false); expect(view.diagnostics.combat.guardFrame).toBe(frame);
    expect(leg.rotationQuaternion!.equalsWithEpsilon(restLeg)).toBe(true);
  });

  it.each(['partial', 'error'] as const)('keeps all equipped combat procedural when equipment is %s', async equipmentStatus => {
    const { view, sim, model, gear } = fixture({ equipmentStatus }); await view.load(); view.update(sim, true);
    expect(createRuenEquippedCombat).not.toHaveBeenCalled(); expect(model.container.animationGroups).toHaveLength(7);
    for (const combo of [1, 2, 3] as const) {
      attack(sim, combo, 0.2); view.update(sim, true);
      expect(view.diagnostics.representation).toBe('fallback'); expect(view.diagnostics.combat.state).toBeNull(); expect(gear.diagnostics.enabled).toBe(false);
    }
    guard(sim); view.update(sim, true); expect(view.diagnostics.representation).toBe('fallback');
    sim.player.shield = false; sim.player.state = 'idle'; view.update(sim, true);
    expect(view.activeClip).toBe('Ruen_Idle_Unarmed'); expect(view.diagnostics.representation).toBe('meshy');
  });

  it('isolates combat authoring errors and disposes all owned combat groups with the hero', async () => {
    const failed = fixture(); vi.mocked(createRuenEquippedCombat).mockReset().mockImplementationOnce(() => { throw new Error('invalid combat rig'); });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); await failed.view.load(); failed.view.update(failed.sim, true);
    expect(failed.view.status).toBe('ready'); expect(failed.view.diagnostics.combat.error).toBe('invalid combat rig');
    expect(failed.view.activeClip).toBe(equipped('Idle')); attack(failed.sim, 1, 0.2); failed.view.update(failed.sim, true);
    expect(failed.view.diagnostics.representation).toBe('fallback'); expect(warn).toHaveBeenCalledOnce();
    const ready = fixture(); await ready.view.load(); guard(ready.sim); ready.view.update(ready.sim, true);
    const owned = Object.values(ready.combatGroups).map(group => vi.spyOn(group, 'dispose'));
    ready.view.dispose(); ready.view.dispose(); owned.forEach(dispose => expect(dispose).toHaveBeenCalledOnce());
    expect(ready.scene.animationGroups).toHaveLength(0); expect(ready.view.diagnostics.combat.state).toBeNull();
  });
});

describe('equipped Meshy traversal visual adapter', () => {
  const gravity = -gameConfig.player.gravity;
  const launchSpeed = Math.sqrt(2 * gravity * gameConfig.player.jumpHeight);

  it('follows a real jump through ascent, descent and landing while the shield remains held', async () => {
    const { view, sim, scene, model, gear } = fixture();
    await view.load(); view.update(sim, true); scene._animate(0);
    const observed = new Set<string>();
    for (let step = 0; step < 70; step++) {
      sim.step(1 / 60, { x: 0, z: 0, jump: step === 0, shield: true });
      const before = structuredClone(sim.player), events = structuredClone(sim.events);
      view.update(sim, true, 0.25); scene._animate(80);
      const role = view.diagnostics.traversal.state;
      if (role) {
        observed.add(role); expect(view.diagnostics.representation).toBe('meshy'); expect(gear.diagnostics.enabled).toBe(true);
        expect(view.diagnostics.combat.state).toBeNull(); expect(view.weights).toEqual({ idle: 0, walk: 0, run: 0 });
        const time = role === 'jump' ? (launchSpeed - sim.player.vy) / gravity : role === 'fall' ? -sim.player.vy / gravity : sim.player.stateTime;
        expect(view.diagnostics.traversal.time).toBeCloseTo(Math.max(0, Math.min(ruenEquippedTraversalProfile.duration[role], time)), 8);
        expect(view.diagnostics.traversal.frame).toBeCloseTo(view.diagnostics.traversal.time * 60, 8);
        expect(view.diagnostics.clips.filter(clip => clip.isPlaying)).toHaveLength(0);
      }
      expect(model.root.position.asArray()).toEqual([sim.player.x, sim.player.y, sim.player.z]);
      expect(model.root.rotation.y).toBe(sim.player.yaw); expect(sim.player).toEqual(before); expect(sim.events).toEqual(events);
    }
    expect([...observed]).toEqual(['jump', 'fall', 'land']);
    expect(view.diagnostics.traversal.state).toBeNull(); expect(view.diagnostics.combat.state).toBe('shield');
  });

  it('uses descending velocity for a ledge fall with a stale state timer and holds the settled fall pose', async () => {
    const { view, sim, scene, joint, traversalGroups } = fixture();
    await view.load(); view.update(sim, true); scene._animate(0);
    sim.player.state = 'fall'; sim.player.grounded = false; sim.player.stateTime = 999; sim.player.vy = -gravity * 0.12;
    sim.age += 0.1; view.update(sim, true); scene._animate(1000);
    expect(view.diagnostics.traversal.time).toBeCloseTo(0.12); expect(view.diagnostics.traversal.phase).toBeCloseTo(0.4);
    const pose = joint.position.clone(); view.update(sim, false); scene._animate(2000);
    expect(traversalGroups.fall!.getCurrentFrame()).toBeCloseTo(7.2); expect(joint.position.equalsWithEpsilon(pose)).toBe(true);
    sim.player.vy = -gravity * 2; sim.age += 0.1; view.update(sim, true); scene._animate(2000);
    expect(view.diagnostics.traversal.phase).toBe(1); expect(traversalGroups.fall!.getCurrentFrame()).toBe(18);
    view.update(sim, true); scene._animate(2000); expect(traversalGroups.fall!.getCurrentFrame()).toBe(18);
  });

  it.each(['land', 'roll'] as const)('keeps %s on the real hero over an edge and freezes its exact controller frame in pause', async role => {
    const { view, sim, scene, traversalGroups, model, joint } = fixture();
    await view.load(); view.update(sim, true); scene._animate(0);
    const duration = ruenEquippedTraversalProfile.duration[role];
    sim.player.state = role; sim.player.grounded = false; sim.player.stateTime = duration / 2; sim.player.shield = true;
    sim.age += 0.1; view.update(sim, true, 0.01); scene._animate(1000);
    expect(view.diagnostics.traversal.state).toBe(role); expect(view.diagnostics.traversal.phase).toBe(0.5);
    expect(view.diagnostics.traversal.entryWeight).toBe(1); expect(view.actualSpeed).toBe(0);
    expect(traversalGroups[role]!.isPlaying).toBe(false); expect(traversalGroups[role]!.getCurrentFrame()).toBeCloseTo(duration * 30);
    const position = joint.position.clone(), rotation = joint.rotationQuaternion!.clone();
    view.update(sim, false); scene._animate(4000);
    expect(joint.position.equalsWithEpsilon(position)).toBe(true); expect(Math.abs(Quaternion.Dot(joint.rotationQuaternion!, rotation))).toBeCloseTo(1);
    expect(model.root.position.y).toBe(sim.player.y);
    sim.player.stateTime = duration; sim.age += 0.1; view.update(sim, true); scene._animate(1000);
    expect(view.diagnostics.traversal.phase).toBe(1); expect(traversalGroups[role]!.getCurrentFrame()).toBeCloseTo(duration * 60);
  });

  it.each([[0, 1, 0], [Math.PI / 2, 0, -1], [-0.7, -1, 1]] as const)('turns the full roll toward its committed direction without changing root yaw %s', async (yaw, rollX, rollZ) => {
    const { view, sim, scene, model, joint, conversion } = fixture({ directionalRig: true });
    await view.load(); sim.player.yaw = yaw; sim.targetId = 'sprout-1'; view.update(sim, true); scene._animate(0);
    sim.player.state = 'roll'; sim.player.rollX = rollX; sim.player.rollZ = rollZ;
    const direction = new Vector3(rollX, 0, rollZ).normalize();
    let firstDirection = 0;
    for (const phase of [0.25, 0.5, 0.75, 1]) {
      sim.player.stateTime = phase * 0.45; sim.age += 0.1; const before = structuredClone(sim.player);
      view.update(sim, true); scene._animate(1000);
      const up = Vector3.TransformNormal(Vector3.Up(), joint.computeWorldMatrix(true)).normalize();
      if (phase === 0.25 || phase === 0.75) {
        const facing = Vector3.Dot(up, direction); expect(Math.abs(facing)).toBeCloseTo(1, 6);
        if (phase === 0.25) firstDirection = facing; else expect(facing * firstDirection).toBeCloseTo(-1, 6);
      } else expect(up.y).toBeCloseTo(phase === 0.5 ? -1 : 1, 6);
      expect(view.diagnostics.traversal.phase).toBeCloseTo(phase);
      expect(view.diagnostics.traversal.entryWeight).toBe(1); expect(sim.player).toEqual(before);
      expect(model.root.rotation.y).toBe(yaw); expect(conversion.scaling.z).toBe(-1);
    }
    sim.player.yaw += 0.3; sim.player.stateTime = 0.45 * 0.25; sim.age += 0.1; view.update(sim, true); scene._animate(0);
    const up = Vector3.TransformNormal(Vector3.Up(), joint.computeWorldMatrix(true)).normalize();
    expect(Math.abs(Vector3.Dot(up, direction))).toBeCloseTo(1, 6); expect(model.root.rotation.y).toBe(sim.player.yaw);
  });

  it.each(['land', 'roll'] as const)('preserves authored lower-body contact during %s entry while blending the upper body', async role => {
    const { view, sim, scene, joint, leg, hand } = fixture({ directionalRig: true });
    await view.load(); view.update(sim, true); scene._animate(0);
    const time = role === 'land' ? 0.02 : 1 / 30;
    const duration = ruenEquippedTraversalProfile.duration[role];
    sim.player.state = role; sim.player.stateTime = time; sim.age += time;
    view.update(sim, true); scene._animate(0);
    const weight = view.diagnostics.traversal.entryWeight;
    expect(weight).toBeGreaterThan(0); expect(weight).toBeLessThan(1);
    // These channels together define the authored foot-support pose. Any
    // partial entry blend of the pelvis or legs invalidates that solve.
    expect(joint.position.y).toBeCloseTo(-0.2 * time / (duration / 2), 8);
    const expectedPelvis = Quaternion.RotationAxis(Vector3.Right(), role === 'roll' ? Math.PI * 2 * time / duration : 0);
    expect(Math.abs(Quaternion.Dot(joint.rotationQuaternion!, expectedPelvis))).toBeCloseTo(1, 8);
    const expectedLeg = Quaternion.RotationAxis(Vector3.Right(), 0.6 * time / (duration / 2));
    expect(Math.abs(Quaternion.Dot(leg.rotationQuaternion!, expectedLeg))).toBeCloseTo(1, 8);
    const expectedHand = Quaternion.RotationAxis(Vector3.Right(), 0.7 + (1.1 - 0.7) * weight);
    expect(Math.abs(Quaternion.Dot(hand.rotationQuaternion!, expectedHand))).toBeCloseTo(1, 8);
    expect(hand.rotationQuaternion!.equalsWithEpsilon(Quaternion.RotationAxis(Vector3.Right(), 1.1))).toBe(false);
  });

  it('gives roll the existing .45s duration and leaves invulnerability and damage decisions in Simulation', async () => {
    const { view, sim, scene } = fixture(); await view.load(); view.update(sim, true);
    sim.step(1 / 60, { x: 0, z: 0, dodge: true }); view.update(sim, true); scene._animate(0);
    expect(view.diagnostics.traversal.state).toBe('roll'); expect(view.diagnostics.traversal.frame).toBe(0);
    for (let i = 0; i < 14; i++) { sim.step(1 / 60, { x: 0, z: 0 }); view.update(sim, true); }
    expect(sim.receiveDamage(1, sim.player, false)).toBe('ignored');
    sim.step(1 / 60, { x: 0, z: 0 }); sim.step(1 / 60, { x: 0, z: 0 });
    view.update(sim, true); expect(view.diagnostics.traversal.frame).toBeCloseTo(sim.player.stateTime * 60);
    expect(sim.receiveDamage(1, sim.player, false)).toBe('hurt');
    view.update(sim, true); expect(view.diagnostics.traversal.state).toBeNull(); expect(view.diagnostics.representation).toBe('fallback');
    sim.player.state = 'roll'; sim.player.stateTime = 0.44; sim.player.invulnerable = 0; sim.player.grounded = true;
    sim.step(1 / 60, { x: 0, z: 0 }); view.update(sim, true);
    expect(sim.player.state).toBe('idle'); expect(view.diagnostics.traversal.state).toBeNull();
  });

  it('clears traversal on attack, hurt, respawn and teleport, and blends its last pose back to locomotion', async () => {
    const { view, sim, scene, traversalGroups, joint, groups } = fixture(); await view.load(); view.update(sim, true); scene._animate(0);
    sim.player.state = 'land'; sim.player.stateTime = 0.06; sim.age += 0.1; view.update(sim, true); scene._animate(0);
    const landingY = joint.position.y;
    sim.player.state = 'idle'; view.update(sim, true); scene._animate(0);
    expect(view.diagnostics.traversal.state).toBeNull(); expect(joint.position.y).toBeCloseTo(landingY);
    sim.age += 0.05; view.update(sim, true); scene._animate(50);
    expect(groups.idle!.weight).toBeCloseTo(0.5); expect(joint.position.y).toBeCloseTo(landingY / 2);
    sim.age += 0.05; view.update(sim, true); scene._animate(50); expect(joint.position.y).toBeCloseTo(0);
    sim.player.state = 'roll'; sim.player.stateTime = 0.2; sim.age += 0.1; view.update(sim, true);
    sim.player.state = 'attack1'; sim.player.combo = 1; sim.player.attackTime = 0.2; sim.age += 0.1; view.update(sim, true);
    expect(view.diagnostics.traversal.state).toBeNull(); expect(view.diagnostics.combat.state).toBe('attack1');
    expect(traversalGroups.roll!.isStarted).toBe(false);
    sim.player.attackTime = -1; sim.player.state = 'roll'; sim.player.stateTime = 0.2; sim.age += 0.1; view.update(sim, true);
    expect(view.diagnostics.combat.state).toBeNull(); expect(view.diagnostics.traversal.state).toBe('roll');
    sim.player.state = 'hurt'; view.update(sim, true); expect(view.diagnostics.traversal.state).toBeNull();
    sim.player.state = 'roll'; sim.player.stateTime = 0.2; sim.age += 0.1; view.update(sim, true);
    sim.respawn(); view.update(sim, true); scene._animate(0); expect(view.diagnostics.traversal.state).toBeNull();
    expect(joint.position.y).toBeCloseTo(0); expect(view.weights).toEqual({ idle: 1, walk: 0, run: 0 });
    sim.player.state = 'roll'; sim.player.stateTime = 0.01; sim.player.z += 40; sim.age += 0.1; view.update(sim, true);
    expect(view.diagnostics.traversal.frame).toBeCloseTo(0.6); expect(view.diagnostics.traversal.entryWeight).toBe(1);
  });

  it.each(['partial', 'error'] as const)('retains procedural traversal when equipment is %s', async equipmentStatus => {
    const { view, sim, gear, model } = fixture({ equipmentStatus }); await view.load(); view.update(sim, true);
    expect(createRuenEquippedTraversal).not.toHaveBeenCalled(); expect(model.container.animationGroups).toHaveLength(7);
    for (const role of ['jump', 'fall', 'land', 'roll'] as const) {
      sim.player.state = role; sim.player.grounded = false; sim.player.stateTime = 0.1; view.update(sim, true);
      expect(view.diagnostics.traversal.state).toBeNull(); expect(view.diagnostics.representation).toBe('fallback'); expect(gear.diagnostics.enabled).toBe(false);
    }
  });

  it('isolates traversal authoring errors from combat and disposes every traversal group exactly once', async () => {
    const failed = fixture(); vi.mocked(createRuenEquippedTraversal).mockReset().mockImplementationOnce(() => { throw new Error('invalid traversal rig'); });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); await failed.view.load();
    expect(failed.view.status).toBe('ready'); expect(failed.view.diagnostics.traversal.error).toBe('invalid traversal rig'); expect(warn).toHaveBeenCalledOnce();
    failed.sim.player.state = 'roll'; failed.sim.player.stateTime = 0.1; failed.view.update(failed.sim, true);
    expect(failed.view.diagnostics.representation).toBe('fallback');
    failed.sim.player.state = 'shield'; failed.sim.player.shield = true; failed.view.update(failed.sim, true);
    expect(failed.view.diagnostics.combat.state).toBe('shield');
    const ready = fixture(); await ready.view.load(); const owned = Object.values(ready.traversalGroups).map(group => vi.spyOn(group, 'dispose'));
    ready.view.dispose(); ready.view.dispose(); owned.forEach(dispose => expect(dispose).toHaveBeenCalledOnce());
    expect(ready.scene.animationGroups).toHaveLength(0); expect(ready.view.diagnostics.traversal.state).toBeNull();
  });
});
