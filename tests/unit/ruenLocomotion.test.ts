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
import { RuenLocomotionView, ruenMeshyProfile } from '../../src/assets/RuenLocomotionView';

vi.mock('../../src/assets/inspectModel', async importOriginal => ({
  ...await importOriginal<typeof import('../../src/assets/inspectModel')>(),
  loadInspectionModel: vi.fn(),
}));

const engines: NullEngine[] = [];
function fixture(names = ['Walking', 'Running', 'Attack', 'Combat_Stance']) {
  const engine = new NullEngine(); engines.push(engine);
  const scene = new Scene(engine);
  const fallback: CharacterRig = { root: new TransformNode('existing-rig', scene), parts: {}, update: vi.fn() };
  const container = new AssetContainer(scene);
  const conversion = new TransformNode('gltf-conversion', scene); conversion.scaling.z = -1;
  const joint = new TransformNode('joint', scene); joint.parent = conversion;
  joint.rotationQuaternion = Quaternion.RotationYawPitchRoll(0.1, 0.2, 0.3);
  joint.scaling.set(0.9, 1.1, 1);
  const mesh = new Mesh('skin', scene); mesh.parent = joint; container.meshes.push(mesh);
  container.transformNodes.push(conversion, joint);
  for (const name of names) {
    const group = new AnimationGroup(name, scene);
    const animation = new Animation(name, 'position.y', 60, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
    animation.setKeys([{ frame: 0, value: 0.5 }, { frame: name === 'Walking' ? 62 : 38, value: 0.6 }]);
    group.addTargetedAnimation(animation, joint);
    const rotation = new Animation(`${name}-rotation`, 'rotationQuaternion', 60, Animation.ANIMATIONTYPE_QUATERNION, Animation.ANIMATIONLOOPMODE_CYCLE);
    rotation.setKeys([{ frame: 0, value: Quaternion.RotationYawPitchRoll(0, 0.8, 0) }, { frame: 38, value: Quaternion.Identity() }]);
    group.addTargetedAnimation(rotation, joint);
    const scale = new Animation(`${name}-scale`, 'scaling', 60, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CYCLE);
    scale.setKeys([{ frame: 0, value: Vector3.One() }, { frame: 38, value: new Vector3(1.1, 0.8, 1.2) }]);
    group.addTargetedAnimation(scale, joint); container.animationGroups.push(group);
  }
  container.removeAllFromScene();
  const model = instantiateInspectionModel(container, scene);
  vi.mocked(loadInspectionModel).mockResolvedValueOnce(model);
  const view = new RuenLocomotionView(scene, fallback);
  const sim = new Simulation();
  const advance = (seconds: number, z: number, x = 0) => {
    sim.age += seconds; sim.player.z += z; sim.player.x += x; view.update(sim, true);
  };
  return { scene, fallback, container, conversion, joint, mesh, model, view, sim, advance };
}

afterEach(() => {
  for (const engine of engines.splice(0)) engine.dispose();
  vi.restoreAllMocks(); vi.resetAllMocks();
});

describe('Meshy locomotion visual adapter', () => {
  it('loads the complete hierarchy under a separate scaled root, without starting any clip', async () => {
    const { view, model, conversion, joint, fallback } = fixture();
    fallback.root.rotation.x = 1.4;
    await view.load();
    expect(view.status).toBe('ready');
    expect(model.root.name).toBe('ruen-meshy-visual');
    expect(model.root.parent).toBeNull();
    expect(model.root.scaling.asArray()).toEqual(Array(3).fill(1.45 / 1.70));
    expect(conversion.parent).toBe(model.root); expect(conversion.scaling.z).toBe(-1);
    expect(joint.parent).toBe(conversion); expect(fallback.root.rotation.x).toBe(1.4);
    expect(model.root.isEnabled()).toBe(false); expect(fallback.root.isEnabled()).toBe(true);
    expect(model.container.animationGroups.every(group => !group.isStarted)).toBe(true);
  });

  it('shows the exact imported rest pose in the initial menu without requiring an Idle clip', async () => {
    const { view, model, sim, joint, mesh, fallback, conversion } = fixture();
    const rest = { y: joint.position.y, rotation: joint.rotationQuaternion!.asArray(), scale: joint.scaling.asArray() };
    const before = structuredClone(sim.player);
    await view.load(); view.update(sim, false);
    expect(view.diagnostics.reason).toBe('idle-pose'); expect(view.diagnostics.representation).toBe('meshy');
    expect(model.root.isEnabled()).toBe(true); expect(fallback.root.isEnabled()).toBe(false);
    expect(view.activeClip).toBeNull(); expect(view.weights).toEqual({ walk: 0, run: 0 });
    expect(model.container.animationGroups.every(group => !group.isStarted)).toBe(true);
    expect(joint.position.y).toBe(rest.y); expect(joint.rotationQuaternion!.asArray()).toEqual(rest.rotation);
    expect(joint.scaling.asArray()).toEqual(rest.scale); expect(conversion.scaling.z).toBe(-1);
    expect(sim.player).toEqual(before);
    // Idle follows the same damage flash and clears any previously dimmed mesh.
    sim.age = 0.02; sim.player.invulnerable = 1; view.update(sim, true); expect(mesh.visibility).toBe(0.4);
    sim.player.invulnerable = 0; view.update(sim, true); expect(mesh.visibility).toBe(1);
  });

  it('returns a rendered running pose smoothly to exact rest, freezes in pause, and remains stable', async () => {
    const { view, model, scene, sim, joint, advance } = fixture();
    const restRotation = joint.rotationQuaternion!.clone(), restScale = joint.scaling.clone();
    await view.load(); sim.player.state = 'run'; view.update(sim, true); scene._animate(0);
    advance(0.1, 0.4); scene._animate(100);
    const runningY = joint.position.y, runningRotation = joint.rotationQuaternion!.clone(), runningScale = joint.scaling.clone();
    expect(runningY).toBeGreaterThan(0);
    sim.player.state = 'idle'; view.update(sim, true);
    expect(view.diagnostics.reason).toBe('idle-transition'); expect(joint.position.y).toBe(runningY);
    expect(model.container.animationGroups.every(group => !group.isStarted)).toBe(true);
    advance(0.1, 0);
    expect(joint.position.y).toBeCloseTo(runningY / 2);
    expect(joint.rotationQuaternion!.equalsWithEpsilon(Quaternion.Slerp(runningRotation, restRotation, 0.5))).toBe(true);
    expect(joint.scaling.equalsWithEpsilon(Vector3.Lerp(runningScale, restScale, 0.5))).toBe(true);
    const pausedY = joint.position.y;
    sim.age += 0.1; view.update(sim, false); scene._animate(100);
    expect(joint.position.y).toBe(pausedY); expect(view.diagnostics.reason).toBe('idle-transition');
    view.update(sim, true); expect(joint.position.y).toBe(pausedY); // 120 Hz frame with no sim step
    advance(0.1, 0); scene._animate(100);
    expect(view.diagnostics.reason).toBe('idle-pose'); expect(joint.position.y).toBe(0);
    expect(joint.rotationQuaternion!.asArray()).toEqual(restRotation.asArray());
    expect(joint.scaling.asArray()).toEqual(restScale.asArray());
    advance(0.25, 0); scene._animate(250);
    expect(joint.position.y).toBe(0); expect(joint.rotationQuaternion!.asArray()).toEqual(restRotation.asArray());
    expect(view.weights).toEqual({ walk: 0, run: 0 }); expect(view.activeClip).toBeNull();
  });

  it('fades from rest into only the requested gait and can interrupt an unfinished idle transition', async () => {
    const { view, scene, container, sim, joint, advance } = fixture();
    await view.load(); view.update(sim, true);
    sim.player.state = 'walk'; advance(0.05, 0.06); scene._animate(0);
    expect(view.weights.walk).toBeGreaterThan(0); expect(view.weights.walk).toBeLessThan(1); expect(view.weights.run).toBe(0);
    expect(container.animationGroups.filter(group => group.isStarted).map(group => group.name)).toEqual(['Walking']);
    expect(joint.position.y).toBeGreaterThan(0); expect(joint.position.y).toBeLessThan(0.5);
    advance(0.1, 0.12); scene._animate(100); advance(0.05, 0.06); scene._animate(50);
    expect(view.weights).toEqual({ walk: 1, run: 0 });
    sim.player.state = 'idle'; advance(0.05, 0); scene._animate(50);
    const intermediate = joint.position.y;
    expect(intermediate).toBeGreaterThan(0); expect(view.diagnostics.reason).toBe('idle-transition');
    sim.player.state = 'run'; view.update(sim, true); scene._animate(0);
    expect(joint.position.y).toBeCloseTo(intermediate); expect(view.weights).toEqual({ walk: 0, run: 0 });
    advance(0.1, 0.4); scene._animate(100); advance(0.1, 0.4); scene._animate(100);
    expect(view.weights).toEqual({ walk: 0, run: 1 });
    expect(container.animationGroups.filter(group => group.isStarted).map(group => group.name)).toEqual(['Running']);
  });

  it('clears previous locomotion poses on respawn, new game and returning from unsupported actions', async () => {
    const { view, scene, model, sim, joint, advance } = fixture();
    const restRotation = joint.rotationQuaternion!.asArray();
    await view.load(); sim.player.state = 'run'; view.update(sim, true); scene._animate(0);
    advance(0.1, 0.4); scene._animate(100); expect(joint.position.y).toBeGreaterThan(0);
    sim.respawn(); view.update(sim, true);
    expect(view.diagnostics.reason).toBe('idle-pose'); expect(joint.position.y).toBe(0);
    expect(joint.rotationQuaternion!.asArray()).toEqual(restRotation);
    sim.player.state = 'run'; advance(0.1, 0.4); scene._animate(100);
    const replacement = new Simulation(); view.update(replacement, false);
    expect(view.diagnostics.reason).toBe('idle-pose'); expect(joint.position.y).toBe(0);
    expect(model.container.animationGroups.every(group => !group.isStarted)).toBe(true);
    replacement.player.state = 'attack1'; view.update(replacement, true);
    joint.position.y = 0.8; // An unsupported pose must not become the next rest pose.
    replacement.player.state = 'idle'; view.update(replacement, true);
    expect(view.diagnostics.reason).toBe('idle-pose'); expect(joint.position.y).toBe(0);
    expect(joint.rotationQuaternion!.asArray()).toEqual(restRotation);
  });

  it('uses actual controller displacement, keeps 120Hz no-step renders running, and freezes at walls', async () => {
    const { view, model, fallback, sim, advance } = fixture();
    await view.load(); sim.player.state = 'walk'; sim.player.vz = 99;
    view.update(sim, true); advance(0.1, 0.12);
    expect(view.actualSpeed).toBeCloseTo(1.2);
    expect(view.diagnostics.clips.find(c => c.name === 'Walking')?.speedRatio).toBeCloseTo(1);
    expect(view.diagnostics.clips.filter(c => c.isPlaying).map(c => c.name)).toEqual(['Walking']);
    expect(model.root.position.z).toBe(sim.player.z); expect(fallback.root.isEnabled()).toBe(false);
    // Same simulation sample on an extra render does not halve the cycle rate.
    view.update(sim, true);
    expect(view.actualSpeed).toBeCloseTo(1.2);
    expect(view.diagnostics.clips.find(c => c.name === 'Walking')?.isPlaying).toBe(true);
    advance(0.05, 0.06);
    expect(view.diagnostics.clips.find(c => c.name === 'Walking')?.speedRatio).toBeCloseTo(1);
    // Desired velocity stays high against a collider, but real movement is zero.
    advance(0.1, 0);
    expect(view.actualSpeed).toBe(0); expect(view.diagnostics.representation).toBe('meshy');
    expect(model.root.isEnabled()).toBe(true); expect(fallback.root.isEnabled()).toBe(false);
    expect(view.diagnostics.clips.every(c => !c.isPlaying)).toBe(true);
    advance(0.1, 0.12);
    expect(view.diagnostics.clips.find(c => c.name === 'Walking')?.isPlaying).toBe(true);
  });

  it('keeps gait aligned when a slow render advances less simulation time than wall time', async () => {
    const { view, sim } = fixture();
    await view.load(); sim.player.state = 'run'; view.update(sim, true);
    // A 250 ms render is capped to 100 ms by the existing controller.
    sim.age += 0.1; sim.player.z += 0.4;
    view.update(sim, true, 0.1 / 0.25);
    const running = view.diagnostics.clips.find(clip => clip.name === 'Running')!;
    expect(view.actualSpeed).toBeCloseTo(4);
    expect(running.speedRatio * 0.25 * ruenMeshyProfile.referenceSpeed.run).toBeCloseTo(0.4);
    expect(running.isPlaying).toBe(true);
  });

  it('phase-aligns a smooth two-clip crossfade and stops the outgoing group', async () => {
    const { view, container, sim, advance } = fixture();
    await view.load(); sim.player.state = 'walk'; view.update(sim, true); advance(0.1, 0.12);
    const walk = container.animationGroups.find(c => c.name === 'Walking')!;
    const run = container.animationGroups.find(c => c.name === 'Running')!;
    walk.goToFrame(31);
    sim.player.state = 'run'; advance(0.05, 0.2);
    expect(run.getCurrentFrame()).toBeCloseTo(19);
    expect(view.weights.run).toBeGreaterThan(0); expect(view.weights.run).toBeLessThan(1);
    expect(view.weights.walk + view.weights.run).toBeCloseTo(1);
    expect(run.speedRatio).toBeCloseTo(1);
    expect(container.animationGroups.filter(c => c.isPlaying).map(c => c.name)).toEqual(['Walking', 'Running']);
    advance(0.1, 0.4); advance(0.05, 0.2);
    expect(view.weights).toEqual({ walk: 0, run: 1 });
    expect(walk.isStarted).toBe(false); expect(run.isPlaying).toBe(true);
    expect(container.animationGroups.filter(c => c.isStarted).map(c => c.name)).toEqual(['Running']);
    // Reversing a transition keeps complementary weights and never starts combat clips.
    sim.player.state = 'walk'; advance(0.05, 0.06);
    sim.player.state = 'run'; advance(0.05, 0.2);
    expect(view.weights.walk + view.weights.run).toBeCloseTo(1);
    expect(container.animationGroups.filter(c => c.isStarted).length).toBeLessThanOrEqual(2);
    expect(container.animationGroups.filter(c => ['Attack', 'Combat_Stance'].includes(c.name)).every(c => !c.isStarted)).toBe(true);
  });

  it('preserves the existing rig for every unvalidated state without changing simulation or its transforms', async () => {
    const { view, model, fallback, sim, advance } = fixture();
    await view.load(); sim.player.state = 'run'; view.update(sim, true); advance(0.1, 0.4);
    for (const state of ['jump', 'fall', 'land', 'roll', 'attack1', 'attack2', 'attack3', 'shield', 'hurt', 'death', 'interact', 'victory'] as const) {
      sim.player.state = state; fallback.root.rotation.x = 1.3;
      const before = structuredClone(sim.player);
      view.update(sim, true);
      expect(sim.player).toEqual(before);
      expect(view.diagnostics.representation).toBe('fallback'); expect(fallback.root.isEnabled()).toBe(true);
      expect(model.root.isEnabled()).toBe(false); expect(fallback.root.rotation.x).toBe(1.3);
      expect(model.container.animationGroups.every(c => !c.isStarted)).toBe(true);
    }
  });

  it('pauses menus and discards motion samples after new game, respawn and teleport', async () => {
    const { view, model, sim, advance } = fixture();
    await view.load(); sim.player.state = 'run'; view.update(sim, true); advance(0.1, 0.4);
    view.update(sim, false);
    expect(view.actualSpeed).toBe(0); expect(view.diagnostics.reason).toBe('paused');
    expect(view.diagnostics.clips.every(c => !c.isPlaying)).toBe(true);
    expect(model.root.isEnabled()).toBe(true);
    advance(0.1, 0.4); expect(view.actualSpeed).toBeCloseTo(4);
    sim.respawn(); sim.player.state = 'run'; sim.age += 0.1; view.update(sim, true);
    expect(view.actualSpeed).toBe(0); expect(view.diagnostics.reason).toBe('controller-reset');
    advance(0.1, 0.4); expect(view.actualSpeed).toBeCloseTo(4);
    sim.player.z += 40; sim.age += 0.1; view.update(sim, true);
    expect(view.actualSpeed).toBe(0); expect(model.root.position.z).toBe(sim.player.z);
    const replacement = new Simulation(); replacement.player.state = 'walk'; replacement.age = sim.age + 0.1;
    view.update(replacement, true);
    expect(view.actualSpeed).toBe(0); expect(view.diagnostics.reason).toBe('controller-reset');
  });

  it('uses the explicit fallback for lock-on strafing and returns to Meshy for forward motion', async () => {
    const { view, sim, advance } = fixture();
    await view.load(); sim.player.state = 'walk'; sim.targetId = 'sprout-1'; sim.player.yaw = 0;
    view.update(sim, true); advance(0.1, 0, 0.12);
    expect(view.diagnostics.reason).toBe('unsupported-direction');
    expect(view.diagnostics.representation).toBe('fallback');
    // The next 120 Hz render and pause cannot switch representations between sim ticks.
    view.update(sim, true);
    expect(view.diagnostics.reason).toBe('unsupported-direction');
    view.update(sim, false);
    expect(view.diagnostics.representation).toBe('fallback');
    advance(0.1, 0.12);
    expect(view.diagnostics.representation).toBe('meshy'); expect(view.activeClip).toBe('Walking');
    expect(ruenMeshyProfile.referenceSpeed).toEqual({ walk: 1.2, run: 4 });
  });

  it('keeps fallback after network failure or missing locomotion clips, and disposes partial loads', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const missing = fixture(['Walking', 'Attack']); await missing.view.load();
    expect(missing.view.status).toBe('error'); expect(missing.view.error).toContain('Running');
    expect(missing.model.root.isDisposed()).toBe(true); expect(missing.fallback.root.isEnabled()).toBe(true);
    const failed = fixture(); vi.mocked(loadInspectionModel).mockReset().mockRejectedValueOnce(new Error('network unavailable'));
    await failed.view.load();
    expect(failed.view.status).toBe('error'); expect(failed.view.error).toBe('network unavailable');
    expect(failed.view.model).toBeUndefined(); expect(failed.fallback.root.isEnabled()).toBe(true);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('disposes a late load and never owns or destroys the existing rig', async () => {
    const { view, fallback, model } = fixture();
    let resolve!: (model: InspectionModel) => void;
    vi.mocked(loadInspectionModel).mockReset().mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const loading = view.load(); view.dispose(); resolve(model); await loading;
    expect(model.root.isDisposed()).toBe(true); expect(fallback.root.isDisposed()).toBe(false);
    expect(fallback.root.isEnabled()).toBe(true); expect(view.model).toBeUndefined();
  });
});
