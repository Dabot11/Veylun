import type { Scene } from '@babylonjs/core/scene';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Simulation, Player, GameEvent } from '../core/Simulation';
import type { CharacterRig } from './characters';
import { assetUrl } from './assetCatalog';
import { loadInspectionModel, type InspectionModel } from './inspectModel';
import { RuenEquipmentPreview, type RuenEquipmentDiagnostics } from './RuenEquipmentPreview';
import { ruenRuntimeEquipmentProfiles } from './ruenEquipmentProfile';
import { createRuenEquippedLocomotion } from './ruenEquippedLocomotion';
import { createRuenEquippedCombat } from './ruenEquippedCombat';
import { createRuenEquippedTraversal, ruenEquippedTraversalProfile } from './ruenEquippedTraversal';
import { createRuenEquippedActions, ruenEquippedActionsProfile } from './ruenEquippedActions';
import { createRuenEquippedDirectional, ruenEquippedDirectionalProfile } from './ruenEquippedDirectional';
import { gameConfig } from '../config/gameConfig';
import { attacks } from '../player/combat';
import { groundHeight } from '../world/level';
import { refineRuenStances } from './ruenNaturalStances';
import { createRuenSoleSampler } from './ruenSoleSupport';

type Locomotion = 'idle' | 'walk' | 'run';
type LoadStatus = 'loading' | 'ready' | 'error';
type Weights = Record<Locomotion, number>;
type CombatRole = 'shield' | 'block' | 'attack1' | 'attack2' | 'attack3';
type CombatGroups = Record<CombatRole, AnimationGroup>;
type TraversalRole = 'jump' | 'fall' | 'land' | 'roll';
type TraversalGroups = Record<TraversalRole, AnimationGroup>;
type ActionRole = 'hurt' | 'death' | 'interact' | 'victory';
type ActionGroups = Record<ActionRole, AnimationGroup>;
type Direction = 'forward' | 'left' | 'right' | 'back';
type DirectionalGroups = ReturnType<typeof createRuenEquippedDirectional>;
type AirLayer = { state: 'jump' | 'fall'; frame: number; time: number };
type CombatLowerLayer = { state: 'jump' | 'fall' | 'land' | 'interact'; frame: number; time: number };
type PoseValue = Vector3 | Quaternion | number;
interface PoseSnapshot { owner: Record<string, unknown>; key: string; value: PoseValue }
interface LowerBodySample { pose: PoseSnapshot[]; support: Map<TransformNode, number> }
const states = ['idle', 'walk', 'run'] as const;
const zeroDirectionalWeights = (): Record<Direction, number> => ({ forward: 0, left: 0, right: 0, back: 0 });
const zeroWeights = (): Weights => ({ idle: 0, walk: 0, run: 0 });
const isLowerBody = (node: TransformNode): boolean => /^mixamorig:(Hips|(Left|Right)(UpLeg|Leg|Foot|ToeBase|Toe_End))$/.test(node.name);

function capturePose(group: AnimationGroup, include: (target: TransformNode) => boolean = () => true): PoseSnapshot[] {
  return group.targetedAnimations.filter(({ target }) => include(target)).map(({ target, animation }) => {
    const path = animation.targetPropertyPath;
    let owner = target as Record<string, unknown>;
    for (const part of path.slice(0, -1)) owner = owner[part] as Record<string, unknown>;
    const key = path[path.length - 1]!, current = owner[key];
    if (!(current instanceof Vector3 || current instanceof Quaternion || typeof current === 'number')) {
      throw new Error('Canal visual no compatible con la mezcla de poses.');
    }
    return { owner, key, value: typeof current === 'number' ? current : current.clone() };
  });
}

/** Blend from a captured pose to the current sampled values. */
function blendFromPose(from: PoseSnapshot[], progress: number): void {
  for (const { owner, key, value } of from) {
    const current = owner[key];
    if (current instanceof Vector3 && value instanceof Vector3) Vector3.LerpToRef(value, current, progress, current);
    else if (current instanceof Quaternion && value instanceof Quaternion) Quaternion.SlerpToRef(value, current, progress, current);
    else if (typeof current === 'number' && typeof value === 'number') owner[key] = value + (current - value) * progress;
  }
}

function restorePose(pose: PoseSnapshot[]): void { blendFromPose(pose, 0); }
function smoothstep(value: number): number { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); }

/** Weighted goToFrame queues a second contribution before the next render.
 * Seek without that queue, then restore the visible pose until normal blending.
 */
function seekForBlend(group: AnimationGroup, frame: number): void {
  const snapshots = group.targetedAnimations.map(({ target, animation }) => {
    const path = animation.targetPropertyPath;
    let owner = target as Record<string, unknown>;
    for (const part of path.slice(0, -1)) owner = owner[part] as Record<string, unknown>;
    const key = path[path.length - 1]!;
    const current = owner[key];
    const value = current instanceof Vector3 || current instanceof Quaternion ? current.clone() : current;
    return { owner, key, value };
  });
  group.goToFrame(frame);
  for (const { owner, key, value } of snapshots) {
    const current = owner[key];
    if (current instanceof Vector3 && value instanceof Vector3) current.copyFrom(value);
    else if (current instanceof Quaternion && value instanceof Quaternion) current.copyFrom(value);
    else owner[key] = value;
  }
}

function fadeProgress(elapsed: number): number {
  return elapsed >= ruenMeshyProfile.crossfadeSeconds - 1e-8 ? 1 : elapsed / ruenMeshyProfile.crossfadeSeconds;
}

export const ruenMeshyProfile = {
  path: 'assets/models/ruen/Meshy_AI_Crimson_Gemwarden_All_Animations.glb',
  scale: 1.45 / 1.70,
  crossfadeSeconds: 0.2,
  // Visual gait calibration; controller movement remains authoritative.
  referenceSpeed: { walk: 1.2, run: 4.0 },
} as const;

interface MotionSample {
  sim: Simulation;
  player: Player;
  age: number;
  x: number;
  z: number;
}

export interface RuenLocomotionDiagnostics {
  status: LoadStatus;
  representation: 'meshy' | 'fallback';
  reason: string;
  speed: number;
  weights: Weights;
  equipped: boolean;
  equipment: RuenEquipmentDiagnostics | null;
  combat: {
    state: CombatRole | null; clip: string | null; frame: number | null; time: number;
    phase: 'guard' | 'block' | 'windup' | 'active' | 'recovery' | null;
    airborne: AirLayer | null; lowerBody: CombatLowerLayer | null;
    entryWeight: number; guardMoving: boolean; guardDirection: number; guardFrame: number; error: string | null;
  };
  traversal: {
    state: TraversalRole | null; clip: string | null; frame: number | null; time: number;
    phase: number; entryWeight: number; direction: number; error: string | null;
  };
  actions: { state: ActionRole | null; clip: string | null; frame: number | null; time: number; phase: number; entryWeight: number; moving: boolean; airborne: AirLayer | null; error: string | null };
  directional: { state: 'walk' | 'run' | null; frame: number | null; phase: number; direction: number; weights: Record<Direction, number>; error: string | null };
  clips: { name: string; isPlaying: boolean; isStarted: boolean; weight: number; speedRatio: number; frame: number }[];
}

/** Visual adapter only. No input, damage, root motion or controller writes. */
export class RuenLocomotionView {
  /** Exterior adjustment only; authored bone translation remains intact. */
  groundOffset = 0;
  private loaded: InspectionModel | undefined;
  private loadingModel: InspectionModel | undefined;
  private equipmentView: RuenEquipmentPreview | undefined;
  private loadState: LoadStatus = 'loading';
  private loadError: string | undefined;
  private pending: Promise<void> | undefined;
  private disposed = false;
  private groups: Record<Locomotion, AnimationGroup> | undefined;
  private combatGroups: CombatGroups | undefined;
  private traversalGroups: TraversalGroups | undefined;
  private traversalError: string | null = null;
  private traversalRole: TraversalRole | null = null;
  private traversalTime = 0;
  private traversalFrame: number | null = null;
  private traversalEntry: { from: PoseSnapshot[]; elapsed: number } | undefined;
  private traversalEntryWeight = 1;
  private traversalDirection = 0;
  private actionGroups: ActionGroups | undefined;
  private actionError: string | null = null;
  private actionRole: ActionRole | null = null;
  private actionTime = 0;
  private actionFrame: number | null = null;
  private actionEntry: { from: PoseSnapshot[]; elapsed: number } | undefined;
  private actionEntryWeight = 1;
  private actionMoving = false;
  private directionalGroups: DirectionalGroups | undefined;
  private directionalError: string | null = null;
  private directionalState: 'walk' | 'run' | null = null;
  private directionalPhase = 0;
  private directionalAngle = 0;
  private directionalFrame: number | null = null;
  private directionalWeights = zeroDirectionalWeights();
  private directionalClip: string | null = null;
  private directionalEntry: { from: PoseSnapshot[]; elapsed: number } | undefined;
  private airborne: AirLayer | null = null;
  private combatLower: CombatLowerLayer | null = null;
  private actionBlockExit: { from: PoseSnapshot[]; elapsed: number } | undefined;
  private combatError: string | null = null;
  private combatRole: CombatRole | null = null;
  private combatTime = 0;
  private combatFrame: number | null = null;
  private combatEntry: { from: PoseSnapshot[]; elapsed: number } | undefined;
  private combatEntryWeight = 1;
  private exitTransition: { from: PoseSnapshot[]; elapsed: number; phase: number | undefined } | undefined;
  private guardElapsed = 0;
  private guardPhase = 0;
  private guardStride = 0;
  private guardYaw = 0;
  private guardFrame = 0;
  private guardMoving = false;
  private blockStart: { sim: Simulation; player: Player; age: number } | undefined;
  private readonly seenBlockEvents = new WeakSet<GameEvent>();
  private sample: MotionSample | undefined;
  private movementDirection: { x: number; z: number } | undefined;
  private directionTarget: string | null = null;
  private speed = 0;
  private blendWeights: Weights = zeroWeights();
  private target: Locomotion | null = null;
  private transition: { startWeights: Weights; elapsed: number } | undefined;
  private representation: 'meshy' | 'fallback' = 'fallback';
  private reason = 'loading';
  private restSupport = new Map<TransformNode, number>();
  private sampleSoles: (() => number) | undefined;

  constructor(private readonly scene: Scene, private readonly fallback: CharacterRig) {
    scene.onAfterAnimationsObservable.add(this.preserveStoppingSupport);
  }

  // Weighted joint rotations do not preserve a solved foot contact. Correct
  // only the final visual blend into grounded Idle, after Babylon has applied
  // its animation weights; the controller/root position remains authoritative.
  private preserveStoppingSupport = (): void => {
    if (!this.loaded || this.representation !== 'meshy' || this.target !== 'idle' || !this.transition || !this.sample?.player.grounded) return;
    const floor = this.loaded.root.position.y;
    const clearance = Math.min(this.sampleSoles ? this.sampleSoles() - floor : Infinity, ...[...this.restSupport].map(([node, restY]) =>
      node.computeWorldMatrix(true).getTranslation().y - restY * this.loaded!.root.scaling.y - floor));
    if (clearance < -1e-6) this.shiftHipsWorld(-clearance);
  };

  get model(): InspectionModel | undefined { return this.loaded; }
  get equipment(): RuenEquipmentPreview | undefined { return this.equipmentView; }
  get status(): LoadStatus { return this.loadState; }
  get error(): string | undefined { return this.loadError; }
  get actualSpeed(): number { return this.speed; }
  get weights(): Weights { return { ...this.blendWeights }; }
  get activeClip(): string | null {
    if (this.actionRole === 'interact' && this.combatRole === 'block') return this.combatGroups?.block.name ?? null;
    if (this.actionRole) return this.actionGroups?.[this.actionRole].name ?? null;
    if (this.directionalState) return this.directionalClip;
    if (this.traversalRole) return this.traversalGroups?.[this.traversalRole].name ?? null;
    if (this.combatRole) return this.combatGroups?.[this.combatRole].name ?? null;
    return this.target ? this.groups?.[this.target].name ?? null : null;
  }
  get diagnostics(): RuenLocomotionDiagnostics {
    return {
      status: this.loadState, representation: this.representation, reason: this.reason,
      speed: this.speed, weights: this.weights,
      equipped: this.equipmentView?.diagnostics.status === 'ready',
      equipment: this.equipmentView?.diagnostics ?? null,
      combat: {
        state: this.combatRole, clip: this.combatRole ? this.activeClip : null, frame: this.combatFrame, time: this.combatTime,
        phase: this.combatRole === 'shield' ? 'guard' : this.combatRole === 'block' ? 'block' : this.combatRole ?
          this.combatTime < attacks[Number(this.combatRole.slice(-1)) - 1]!.windup ? 'windup' :
            this.combatTime < attacks[Number(this.combatRole.slice(-1)) - 1]!.activeEnd ? 'active' : 'recovery' : null,
        airborne: this.combatRole ? this.airborne : null, lowerBody: this.combatRole ? this.combatLower ?? this.airborne : null,
        entryWeight: this.combatEntryWeight, guardMoving: this.guardMoving, guardDirection: this.guardYaw,
        guardFrame: this.guardFrame, error: this.combatError,
      },
      traversal: {
        state: this.traversalRole, clip: this.traversalRole ? this.activeClip : null, frame: this.traversalFrame, time: this.traversalTime,
        phase: this.traversalRole ? this.traversalTime / ruenEquippedTraversalProfile.duration[this.traversalRole] : 0,
        entryWeight: this.traversalEntryWeight, direction: this.traversalDirection, error: this.traversalError,
      },
      actions: {
        state: this.actionRole, clip: this.actionRole ? this.actionGroups?.[this.actionRole].name ?? null : null, frame: this.actionFrame, time: this.actionTime,
        phase: this.actionRole ? this.actionTime / ruenEquippedActionsProfile.duration[this.actionRole] : 0,
        entryWeight: this.actionEntryWeight, moving: this.actionMoving, airborne: this.actionRole ? this.airborne : null, error: this.actionError,
      },
      directional: { state: this.directionalState, frame: this.directionalFrame, phase: this.directionalPhase, direction: this.directionalAngle, weights: { ...this.directionalWeights }, error: this.directionalError },
      clips: this.groups ? this.ownedGroups().map(group => ({
        name: group.name, isPlaying: group.isPlaying, isStarted: !!group.isStarted,
        weight: group.weight, speedRatio: group.speedRatio, frame: group.getCurrentFrame(),
      })) : [],
    };
  }

  async load(): Promise<void> {
    if (this.disposed || this.loaded) return;
    if (this.pending) return this.pending;
    this.loadState = 'loading'; this.loadError = undefined; this.reason = 'loading';
    this.pending = this.loadModel();
    try { await this.pending; } finally { this.pending = undefined; }
  }

  /** Called for new controller events at their fixed-step timestamp. Never emits damage. */
  handleEvent(event: GameEvent, sim: Simulation): void {
    // An interruption can occur between renders, after an earlier fixed-step
    // block. Clear it even when that interrupted pose is never rendered.
    if (['hurt', 'death', 'dodge', 'respawn', 'sword', 'restore'].includes(event.type)) this.blockStart = undefined;
    if (event.type !== 'shield' || this.seenBlockEvents.has(event)) return;
    this.seenBlockEvents.add(event);
    const p = sim.player;
    if (this.disposed || !this.combatGroups || sim.mode !== 'playing' || !(p.state === 'shield' && p.grounded || (p.state === 'land' || p.state === 'jump' || p.state === 'fall') && this.traversalGroups || p.state === 'interact' && this.actionGroups) ||
      !p.shield || p.attackTime >= 0 || p.health <= 0 || !Number.isFinite(sim.age)) return;
    this.blockStart = { sim, player: p, age: sim.age };
  }

  private async loadModel(): Promise<void> {
    let model: InspectionModel | undefined;
    let equipment: RuenEquipmentPreview | undefined;
    try {
      model = await loadInspectionModel(assetUrl(ruenMeshyProfile.path), this.scene);
      if (this.disposed || this.scene.isDisposed) { model.dispose(); return; }
      this.loadingModel = model;
      model.root.setEnabled(false);
      model.player.stopAll();
      for (const name of ['Walking', 'Running']) {
        const matches = model.container.animationGroups.filter(group => group.name === name);
        const group = matches[0];
        if (matches.length !== 1 || !group || group.to <= group.from || !group.targetedAnimations.length) {
          throw new Error(`Se requiere un clip válido y único «${name}».`);
        }
      }
      equipment = new RuenEquipmentPreview(this.scene, model, ruenRuntimeEquipmentProfiles);
      this.equipmentView = equipment;
      equipment.setEnabled(false);
      await equipment.load();
      if (this.disposed || this.scene.isDisposed) {
        equipment.dispose(); if (!model.root.isDisposed()) model.dispose(); this.loadingModel = undefined; return;
      }
      // Author while the imported rig and exterior root retain their rest transforms.
      // A failed piece leaves an unarmed breathing hero available; partial gear stays hidden.
      const groups = createRuenEquippedLocomotion(model, this.scene, equipment.diagnostics.status === 'ready');
      model.container.animationGroups.push(...Object.values(groups));
      this.groups = groups;
      if (equipment.diagnostics.status === 'ready') {
        try {
          this.combatGroups = createRuenEquippedCombat(model, this.scene, groups);
          model.container.animationGroups.push(...Object.values(this.combatGroups));
        } catch (error) {
          this.combatError = error instanceof Error ? error.message : String(error);
          console.warn('El combate de Ruen conserva el modelo provisional.', error);
        }
        try {
          this.traversalGroups = createRuenEquippedTraversal(model, this.scene, groups);
          model.container.animationGroups.push(...Object.values(this.traversalGroups));
        } catch (error) {
          this.traversalError = error instanceof Error ? error.message : String(error);
          console.warn('El salto y la rodada de Ruen conservan el modelo provisional.', error);
        }
        try {
          this.actionGroups = createRuenEquippedActions(model, this.scene, groups);
          model.container.animationGroups.push(...Object.values(this.actionGroups));
        } catch (error) {
          this.actionError = error instanceof Error ? error.message : String(error);
          console.warn('Las acciones de Ruen conservan el modelo provisional.', error);
        }
        try {
          this.directionalGroups = createRuenEquippedDirectional(model, this.scene, groups);
          model.container.animationGroups.push(...Object.values(this.directionalGroups));
        } catch (error) {
          this.directionalError = error instanceof Error ? error.message : String(error);
          console.warn('El movimiento lateral de Ruen conserva el modelo provisional.', error);
        }
        refineRuenStances(model, this.scene, groups, this.combatGroups);
      }
      this.restSupport = new Map(model.container.transformNodes.filter(node => /^mixamorig:(Left|Right)(Foot|ToeBase|Toe_End)$/.test(node.name))
        .map(node => [node, node.computeWorldMatrix(true).getTranslation().y]));
      this.sampleSoles = createRuenSoleSampler(model);
      model.root.name = 'ruen-meshy-visual';
      model.root.scaling.setAll(ruenMeshyProfile.scale);
      // Keep the glTF conversion and all hand-mounted assets under this independent root.
      // Never parent it to the procedural rig's animated root.
      for (const group of this.ownedGroups()) group.weight = 0;
      this.loaded = model; this.loadingModel = undefined; this.loadState = 'ready'; this.reason = 'awaiting-controller';
    } catch (error) {
      equipment?.dispose(); this.equipmentView = undefined;
      if (model && !model.root.isDisposed()) model.dispose();
      this.loaded = undefined; this.loadingModel = undefined; this.groups = undefined; this.combatGroups = undefined; this.traversalGroups = undefined; this.actionGroups = undefined; this.directionalGroups = undefined;
      if (this.disposed) return;
      this.loadState = 'error';
      this.loadError = error instanceof Error ? error.message : String(error);
      this.showFallback('load-error');
      console.warn('No se pudo cargar Ruen Meshy; se conserva el rig provisional.', error);
    }
  }

  update(sim: Simulation, playing: boolean, playbackTimeScale = 1): void {
    if (this.disposed) return;
    const p = sim.player;
    if (![p.x, p.y, p.z, p.yaw, sim.age].every(Number.isFinite)) {
      this.sample = undefined; this.speed = 0; this.showFallback('invalid-controller'); return;
    }
    const previous = this.sample;
    this.sample = { sim, player: p, age: sim.age, x: p.x, z: p.z };
    const elapsed = previous ? sim.age - previous.age : 0;
    const dx = previous ? p.x - previous.x : 0, dz = previous ? p.z - previous.z : 0;
    const distance = Math.hypot(dx, dz);
    // Respawn/new game replaces these objects. Discard checkpoint/teleport deltas.
    const reset = !previous || previous.sim !== sim || previous.player !== p || elapsed < 0 || elapsed > 0.5 ||
      (elapsed === 0 && distance > 0.000001) || distance > Math.max(0.75, elapsed * 12);
    const dt = !reset && playing && sim.mode === 'playing' && elapsed > 0 ? elapsed : 0;
    // Extra 120 Hz renders keep the most recently measured controller rate.
    if (reset || !playing || sim.mode !== 'playing') this.speed = 0;
    else if (dt > 0) this.speed = distance / dt;
    if (reset || !sim.targetId || this.directionTarget !== sim.targetId) this.movementDirection = undefined;
    this.directionTarget = sim.targetId;
    if (sim.targetId && dt > 0 && distance > 0.0001) this.movementDirection = { x: dx / distance, z: dz / distance };
    if (!this.loaded || !this.groups) { this.showFallback(this.loadState === 'error' ? 'load-error' : 'loading'); return; }

    this.loaded.root.position.set(p.x, p.y + this.groundOffset, p.z);
    this.loaded.root.rotation.set(0, p.yaw, 0);
    if (reset) { this.clearCombat(); this.clearTraversal(); this.clearActions(); this.clearDirectional(); }
    const action: ActionRole | null = sim.mode === 'dead' ? 'death' : sim.mode === 'restoring' || sim.mode === 'won' ? 'victory' :
      p.state === 'hurt' || p.state === 'interact' ? p.state : null;
    if (this.actionGroups && action && Number.isFinite(action === 'death' || action === 'victory' ? sim.modeTime : p.stateTime)) {
      this.showActions(sim, action, dt, dx, dz, distance, reset, playing); return;
    }
    const airGuard = !p.grounded && p.shield && p.attackTime < 0 && (p.state === 'jump' || p.state === 'fall') && Number.isFinite(p.vy);
    const landingGuard = p.state === 'land' && p.shield && p.attackTime < 0 && Number.isFinite(p.stateTime);
    if ((airGuard || landingGuard) && this.combatGroups && this.traversalGroups && p.health > 0 && sim.mode === 'playing') {
      this.showCombat(sim, null, dt, dx, dz, distance, reset, playing); return;
    }
    const traversal = p.state === 'jump' || p.state === 'fall' || p.state === 'land' || p.state === 'roll' ? p.state : null;
    const airborneTraversal = traversal === 'jump' || traversal === 'fall';
    if (this.traversalGroups && traversal && p.attackTime < 0 && p.health > 0 && sim.mode === 'playing' &&
      (airborneTraversal ? !p.grounded && Number.isFinite(p.vy) : Number.isFinite(p.stateTime) && p.stateTime >= 0)) {
      this.showTraversal(sim, traversal, dt, reset, playing);
      return;
    }
    const attack = p.state === 'attack1' || p.state === 'attack2' || p.state === 'attack3' ? p.state : null;
    const guarding = p.state === 'shield' && p.shield && p.attackTime < 0;
    if (this.combatGroups && (p.grounded || this.traversalGroups && Number.isFinite(p.vy)) && p.health > 0 && sim.mode === 'playing' &&
      (guarding && p.grounded || attack && Number.isFinite(p.attackTime) && p.attackTime >= 0 && p.combo === Number(attack.slice(-1)))) {
      this.showCombat(sim, attack, dt, dx, dz, distance, reset, playing);
      return;
    }
    this.blockStart = undefined;
    const kind = states.find(state => state === p.state);
    if (!kind || !p.grounded || p.shield || p.attackTime >= 0 || p.health <= 0 || sim.mode !== 'playing') {
      this.showFallback(`unsupported-state:${p.state}`); return;
    }
    if (kind !== 'idle' && sim.targetId && this.directionalGroups) {
      this.showDirectional(sim, kind, dt, distance, reset, playing); return;
    }
    // A directional authoring/load failure keeps the procedural fallback.
    if (kind !== 'idle' && sim.targetId && this.movementDirection &&
      this.movementDirection.x * Math.sin(p.yaw) + this.movementDirection.z * Math.cos(p.yaw) < Math.cos(Math.PI / 4)) {
      this.showFallback('unsupported-direction'); return;
    }

    if (this.combatRole || this.traversalRole || this.actionRole || this.directionalState) {
      const from = capturePose(this.groups.idle);
      const phase = this.directionalState ? this.directionalPhase : this.guardStride > 0 ? this.guardPhase : undefined;
      this.resetClips(); this.clearCombat(); this.clearTraversal(); this.clearActions(); this.clearDirectional();
      restorePose(from); this.exitTransition = { from, elapsed: 0, phase };
    } else if (reset || this.representation !== 'meshy') this.resetClips();
    if (this.target !== kind) this.select(kind);
    this.fallback.root.setEnabled(false); this.loaded.root.setEnabled(true);
    this.equipmentView?.setEnabled(this.equipmentView.diagnostics.status === 'ready');
    this.representation = 'meshy';
    this.applyVisibility(sim);
    const clockRatio = Number.isFinite(playbackTimeScale) && playbackTimeScale > 0 ? playbackTimeScale : 0;
    const animate = playing && !reset && clockRatio > 0 && (kind === 'idle' || this.speed > 0.01);
    if (animate && this.transition) {
      this.transition.elapsed += dt;
      const t = fadeProgress(this.transition.elapsed), eased = t * t * (3 - 2 * t);
      for (const key of states) {
        const start = this.transition.startWeights[key];
        this.blendWeights[key] = start + ((key === kind ? 1 : 0) - start) * eased;
      }
      if (t === 1) { this.blendWeights = zeroWeights(); this.blendWeights[kind] = 1; this.transition = undefined; }
    }
    if (animate && this.exitTransition) {
      this.exitTransition.elapsed += dt;
      if (this.exitTransition.elapsed >= 0.1 - 1e-8) this.exitTransition = undefined;
    }
    const exitWeight = this.exitTransition ? smoothstep(this.exitTransition.elapsed / 0.1) : 1;
    for (const key of states) {
      const group = this.groups[key];
      // During combat exit, the remaining weight blends against the exact
      // captured last combat pose used when the incoming runtime was started.
      group.weight = this.blendWeights[key] * exitWeight;
      if (this.exitTransition && kind !== 'idle') {
        // Keep the incoming gait's solved foot support intact. The captured
        // gesture fades only through torso/arm channels during this exit.
        for (const animatable of group.animatables) if (isLowerBody(animatable.target)) animatable.weight = this.blendWeights[key];
      }
      // Idle breathes at its authored rate. Gaits advance only by actual movement.
      // Babylon uses wall time; this ratio honors the existing simulation-time cap.
      group.speedRatio = (key === 'idle' ? 1 : this.speed / ruenMeshyProfile.referenceSpeed[key]) * clockRatio;
      if (group.weight === 0 && !this.exitTransition && (!this.transition || !group.isStarted)) group.stop(true);
      else if (animate) { if (!group.isPlaying) group.play(true); }
      else group.pause();
    }
    this.reason = !playing || clockRatio === 0 ? 'paused' : reset ? 'controller-reset' : dt === 0 ? 'no-simulation-step' :
      !animate ? 'controller-stationary' : this.transition ? 'crossfade' : kind === 'idle' ? 'idle-animation' : 'locomotion';
  }

  private ownedGroups(): AnimationGroup[] {
    return [this.groups, this.combatGroups, this.traversalGroups, this.actionGroups, this.directionalGroups].flatMap(groups => Object.values(groups ?? {}));
  }

  private releaseAirLayer(): void {
    if (this.airborne) this.traversalGroups?.[this.airborne.state].stop(true);
    this.airborne = null;
  }

  private sampleAirLower(sim: Simulation): PoseSnapshot[] | undefined {
    if (!this.traversalGroups || !Number.isFinite(sim.player.vy)) return undefined;
    const state = sim.player.vy > 0 ? 'jump' : 'fall';
    if (this.airborne && this.airborne.state !== state) this.releaseAirLayer();
    const gravity = -gameConfig.player.gravity;
    const launch = Math.sqrt(2 * gravity * gameConfig.player.jumpHeight);
    const time = Math.max(0, Math.min(ruenEquippedTraversalProfile.duration[state], state === 'jump' ? (launch - sim.player.vy) / gravity : -sim.player.vy / gravity));
    const group = this.traversalGroups[state];
    this.sampleManual(group, group.from + time * group.targetedAnimations[0]!.animation.framePerSecond, 0);
    this.airborne = { state, time, frame: group.getCurrentFrame() };
    return capturePose(group, isLowerBody);
  }

  private showDirectional(sim: Simulation, kind: 'walk' | 'run', dt: number, distance: number, reset: boolean, playing: boolean): void {
    if (!this.groups || !this.directionalGroups || !this.loaded) return;
    if (reset || this.representation !== 'meshy' || this.directionalState !== kind) {
      const source = this.target && this.target !== 'idle' ? this.groups[this.target] : undefined;
      const phase = reset ? 0 : this.directionalState ? this.directionalPhase : source?.isStarted ? (source.getCurrentFrame() - source.from) / (source.to - source.from) : 0;
      const from = !reset && this.representation === 'meshy' ? capturePose(this.groups.idle, node => !isLowerBody(node)) : undefined;
      this.resetClips(); this.clearCombat(); this.clearTraversal(); this.clearActions(); this.clearDirectional();
      this.directionalState = kind; this.directionalPhase = phase;
      this.directionalEntry = from ? { from, elapsed: 0 } : undefined;
    }
    if (this.movementDirection) {
      const { x, z } = this.movementDirection;
      this.directionalAngle = Math.atan2(x * Math.cos(sim.player.yaw) - z * Math.sin(sim.player.yaw), x * Math.sin(sim.player.yaw) + z * Math.cos(sim.player.yaw));
    }
    const amount = Math.abs(this.directionalAngle) / (Math.PI / 2), side = this.directionalAngle < 0 ? 'left' : 'right';
    this.directionalWeights = zeroDirectionalWeights();
    this.directionalWeights[side] = amount <= 1 ? amount : 2 - amount;
    this.directionalWeights[amount <= 1 ? 'forward' : 'back'] = amount <= 1 ? 1 - amount : amount - 1;
    const clips: Record<Direction, AnimationGroup> = {
      forward: this.groups[kind],
      left: this.directionalGroups[`${kind}Left`], right: this.directionalGroups[`${kind}Right`], back: this.directionalGroups[`${kind}Back`],
    };
    const directions: Direction[] = ['forward', 'left', 'right', 'back'];
    // Forward and directional sources can differ in duration; use their
    // weighted stride distances while keeping a common foot-cycle phase.
    const cycleDistance = directions.reduce((sum, direction) => {
      const clip = clips[direction], duration = (clip.to - clip.from) / clip.targetedAnimations[0]!.animation.framePerSecond;
      return sum + this.directionalWeights[direction] * duration * ruenEquippedDirectionalProfile.referenceSpeed[kind];
    }, 0);
    if (dt > 0 && this.speed > 0.01) this.directionalPhase = (this.directionalPhase + distance / cycleDistance) % 1;
    for (const direction of directions) if (this.directionalWeights[direction] <= 1e-8) { clips[direction].weight = 0; clips[direction].stop(true); }
    const feet = [...this.captureSupport().keys()];
    const expectedHeights = new Map(feet.map(node => [node, 0]));
    let accumulated: PoseSnapshot[] | undefined, total = 0, dominant = -1;
    for (const direction of directions) {
      const weight = this.directionalWeights[direction]; if (weight <= 1e-8) continue;
      const clip = clips[direction];
      this.sampleManual(clip, clip.from + this.directionalPhase * (clip.to - clip.from), weight);
      for (const foot of feet) expectedHeights.set(foot, expectedHeights.get(foot)! + foot.computeWorldMatrix(true).getTranslation().y * weight);
      if (accumulated) blendFromPose(accumulated, weight / (total + weight));
      total += weight; accumulated = capturePose(clip);
      if (weight > dominant) { dominant = weight; this.directionalClip = clip.name; this.directionalFrame = clip.getCurrentFrame(); }
    }
    // Quaternion blending does not preserve the sources' solved foot contact.
    // Correct only the pelvis height to retain their expected support envelope.
    this.preserveSupport(expectedHeights);
    if (this.directionalEntry) {
      this.directionalEntry.elapsed += dt;
      const progress = this.directionalEntry.elapsed / 0.08;
      blendFromPose(this.directionalEntry.from, smoothstep(progress));
      if (progress >= 1) this.directionalEntry = undefined;
    }
    this.fallback.root.setEnabled(false); this.loaded.root.setEnabled(true); this.equipmentView?.setEnabled(true);
    this.representation = 'meshy'; this.applyVisibility(sim);
    this.reason = !playing ? 'paused' : this.speed <= 0.01 ? 'controller-stationary' : 'directional-locomotion';
  }

  private showActions(sim: Simulation, role: ActionRole, dt: number, dx: number, dz: number, distance: number, reset: boolean, playing: boolean): void {
    if (!this.groups || !this.actionGroups || !this.loaded) return;
    const p = sim.player, duration = ruenEquippedActionsProfile.duration[role];
    const savedVictory = role === 'victory' && sim.mode === 'won' && p.state !== 'victory';
    const clock = savedVictory ? duration : role === 'death' || role === 'victory' ? sim.modeTime : p.stateTime;
    const time = Math.max(0, Math.min(duration, clock));
    if (reset || this.representation !== 'meshy' || this.actionRole !== role || time < this.actionTime - 1e-8) {
      const from = !reset && this.representation === 'meshy' ? capturePose(this.groups.idle, node => !isLowerBody(node)) : undefined;
      const pendingBlock = role === 'interact' ? this.blockStart : undefined;
      this.resetClips(); this.clearCombat(); this.clearTraversal(); this.clearActions(); this.clearDirectional();
      this.blockStart = pendingBlock;
      this.actionRole = role; this.actionEntry = from ? { from, elapsed: 0 } : undefined;
    }
    const mobile = role === 'hurt' || role === 'interact';
    const gait = this.speed > 2.5 ? 'run' : 'walk';
    const block = this.blockStart, blockGroup = this.combatGroups?.block;
    const blockTime = block ? sim.age - block.age : -1;
    const blocking = role === 'interact' && p.shield && blockGroup && block && block.sim === sim && block.player === p &&
      blockTime >= 0 && blockTime < (blockGroup.to - blockGroup.from) / blockGroup.targetedAnimations[0]!.animation.framePerSecond;
    if (!blocking) this.blockStart = undefined;
    if (!blocking && this.combatRole === 'block') {
      this.actionBlockExit = { from: capturePose(this.groups.idle, node => !isLowerBody(node)), elapsed: 0 };
      blockGroup?.stop(true); if (blockGroup) blockGroup.weight = 0;
      this.combatRole = null; this.combatTime = 0; this.combatFrame = null; this.combatLower = null; this.blockStart = undefined;
    }
    const airPose = mobile && !p.grounded ? this.sampleAirLower(sim) : undefined;
    if (!airPose) this.releaseAirLayer();
    const steps = mobile && p.grounded ? this.sampleGuardSteps(sim, dt, dx, dz, distance, gait) : undefined;
    const group = this.actionGroups[role];
    this.sampleManual(group, group.from + time * group.targetedAnimations[0]!.animation.framePerSecond, 1);
    this.actionTime = time; this.actionFrame = group.getCurrentFrame(); this.actionMoving = mobile && p.grounded && this.speed > 0.01;
    this.actionEntryWeight = 1;
    if (this.actionEntry) {
      const progress = time / (role === 'hurt' ? 0.035 : 0.06);
      this.actionEntryWeight = smoothstep(progress); blendFromPose(this.actionEntry.from, this.actionEntryWeight);
      if (progress >= 1) this.actionEntry = undefined;
    }
    if (blocking) {
      const gesture = capturePose(group), lower = capturePose(group, isLowerBody);
      this.sampleManual(blockGroup, blockGroup.from + blockTime * blockGroup.targetedAnimations[0]!.animation.framePerSecond, 1);
      this.combatEntryWeight = smoothstep(blockTime / 0.035);
      blendFromPose(gesture, this.combatEntryWeight); restorePose(lower);
      group.weight = 0; this.combatRole = 'block'; this.combatTime = blockTime; this.combatFrame = blockGroup.getCurrentFrame();
      this.combatLower = { state: 'interact', frame: this.actionFrame!, time }; this.actionBlockExit = undefined;
    } else if (this.actionBlockExit) {
      this.actionBlockExit.elapsed += dt;
      const progress = this.actionBlockExit.elapsed / 0.05;
      blendFromPose(this.actionBlockExit.from, smoothstep(progress));
      if (progress >= 1) this.actionBlockExit = undefined;
    }
    if (steps) this.applyGuardSteps(steps, gait);
    if (airPose) restorePose(airPose);
    if (role === 'death') {
      // Death freezes controller physics, even above a ledge. Let only the
      // visible collapse settle to the floor while preserving root motion.
      const drop = Math.max(0, p.y - groundHeight(p.x, p.z)) * smoothstep(time / ruenEquippedActionsProfile.holdFrom.death);
      this.shiftHipsWorld(-drop);
    }
    this.fallback.root.setEnabled(false); this.loaded.root.setEnabled(true); this.equipmentView?.setEnabled(true);
    this.representation = 'meshy'; this.applyVisibility(sim); this.reason = !playing ? 'paused' : blocking ? 'block-reaction' : `action:${role}`;
  }

  private showTraversal(sim: Simulation, role: TraversalRole, dt: number, reset: boolean, playing: boolean): void {
    if (!this.groups || !this.traversalGroups || !this.loaded) return;
    const p = sim.player, duration = ruenEquippedTraversalProfile.duration[role];
    const gravity = -gameConfig.player.gravity;
    const launchSpeed = Math.sqrt(2 * gravity * gameConfig.player.jumpHeight);
    // stateTime is not reset at the jump/fall boundary. Vertical velocity is
    // the simulation's authoritative ascent/descent clock, including ledges.
    const controllerTime = role === 'jump' ? (launchSpeed - p.vy) / gravity : role === 'fall' ? -p.vy / gravity : p.stateTime;
    const time = Math.max(0, Math.min(duration, controllerTime));
    const changed = this.traversalRole !== role || time < this.traversalTime - 1e-8;
    if (reset || this.representation !== 'meshy' || changed) {
      // The authored crouch/support solve keeps the feet above the floor.
      // Blending its pelvis or legs independently would break that contact.
      const preserveContact = role === 'land' || role === 'roll';
      const from = !reset && this.representation === 'meshy' ?
        capturePose(this.groups.idle, node => !preserveContact || !isLowerBody(node)) : undefined;
      this.resetClips(); this.clearCombat(); this.clearTraversal(); this.clearActions(); this.clearDirectional();
      this.traversalEntry = from ? { from, elapsed: 0 } : undefined;
      this.traversalRole = role;
    }
    const group = this.traversalGroups[role];
    this.sampleManual(group, group.from + time * group.targetedAnimations[0]!.animation.framePerSecond, 1);
    this.traversalTime = time; this.traversalFrame = group.getCurrentFrame();
    this.traversalDirection = 0;
    if (role === 'roll') {
      // Lock-on can rotate p.yaw while the committed dodge keeps rollX/rollZ.
      // Rotate only the animated pelvis; the exterior root stays authoritative.
      const heading = Number.isFinite(p.rollX) && Number.isFinite(p.rollZ) && Math.hypot(p.rollX, p.rollZ) > 1e-8 ?
        Math.atan2(p.rollX, p.rollZ) : p.yaw;
      this.traversalDirection = Math.atan2(Math.sin(heading - p.yaw), Math.cos(heading - p.yaw));
      this.turnHips(this.traversalDirection);
    }
    this.traversalEntryWeight = 1;
    if (this.traversalEntry) {
      this.traversalEntry.elapsed += dt;
      const progress = role === 'fall' ? this.traversalEntry.elapsed / 0.06 : time / (role === 'land' ? 0.035 : 0.05);
      this.traversalEntryWeight = smoothstep(progress);
      blendFromPose(this.traversalEntry.from, this.traversalEntryWeight);
      if (progress >= 1) this.traversalEntry = undefined;
    }
    this.fallback.root.setEnabled(false); this.loaded.root.setEnabled(true); this.equipmentView?.setEnabled(true);
    this.representation = 'meshy'; this.applyVisibility(sim);
    this.reason = !playing ? 'paused' : `traversal:${role}`;
  }

  private captureSupport(): Map<TransformNode, number> {
    return new Map((this.loaded?.container.transformNodes ?? []).filter(node => /^mixamorig:(Left|Right)(Foot|ToeBase|Toe_End)$/.test(node.name))
      .map(node => [node, node.computeWorldMatrix(true).getTranslation().y]));
  }

  private preserveSupport(support: Map<TransformNode, number>): void {
    const lift = Math.max(0, ...[...support].map(([foot, height]) => height - foot.computeWorldMatrix(true).getTranslation().y));
    if (lift > 1e-8) this.shiftHipsWorld(lift);
  }

  private shiftHipsWorld(y: number): void {
    const hips = this.loaded?.container.transformNodes.find(node => node.name === 'mixamorig:Hips');
    const parent = hips?.parent as TransformNode | null;
    if (hips && parent) hips.position.addInPlace(Vector3.TransformNormal(new Vector3(0, y, 0), Matrix.Invert(parent.computeWorldMatrix(true))));
  }

  /** Rotate a sampled pelvis in world Y, respecting the reflected glTF parent. */
  private turnHips(direction: number): void {
    const hips = this.loaded?.container.transformNodes.find(node => node.name === 'mixamorig:Hips');
    const parent = hips?.parent as TransformNode | null;
    if (!hips?.rotationQuaternion || !parent) return;
    const parentBasis = parent.computeWorldMatrix(true).clone(); parentBasis.setTranslation(Vector3.Zero());
    const turn = parentBasis.multiply(Matrix.RotationY(direction)).multiply(Matrix.Invert(parentBasis));
    const localRotation = Matrix.Compose(Vector3.One(), hips.rotationQuaternion, Vector3.Zero()).multiply(turn);
    hips.rotationQuaternion.copyFrom(Quaternion.FromRotationMatrix(localRotation).normalize());
  }

  private showCombat(
    sim: Simulation, attack: 'attack1' | 'attack2' | 'attack3' | null,
    dt: number, dx: number, dz: number, distance: number, reset: boolean, playing: boolean,
  ): void {
    if (!this.groups || !this.combatGroups || !this.loaded) return;
    this.clearTraversal(); this.clearActions(); this.clearDirectional();
    const p = sim.player;
    const wasGuard = this.combatRole === 'shield' || this.combatRole === 'block';
    if (!attack && !wasGuard) {
      this.guardElapsed = this.guardPhase = this.guardStride = this.guardYaw = this.guardFrame = 0;
    }
    let role: CombatRole, time: number;
    if (attack) {
      role = attack; time = Math.min(attacks[Number(attack.slice(-1)) - 1]!.duration, p.attackTime);
      this.blockStart = undefined; this.guardMoving = false;
    } else {
      this.guardElapsed += dt;
      const block = this.blockStart;
      const group = this.combatGroups.block;
      const duration = (group.to - group.from) / group.targetedAnimations[0]!.animation.framePerSecond;
      const elapsed = block ? sim.age - block.age : -1;
      if (block && block.sim === sim && block.player === p && elapsed >= 0 && elapsed < duration) {
        role = 'block'; time = elapsed;
      } else {
        this.blockStart = undefined; role = 'shield';
        const shield = this.combatGroups.shield;
        const seconds = (shield.to - shield.from) / shield.targetedAnimations[0]!.animation.framePerSecond;
        time = this.guardElapsed % seconds;
      }
    }
    const changed = this.combatRole !== role || attack !== null && time < this.combatTime - 1e-8;
    if (reset || this.representation !== 'meshy' || changed) {
      const from = !reset && this.representation === 'meshy' ? capturePose(this.groups.idle) : undefined;
      this.resetClips();
      this.combatEntry = from ? { from, elapsed: 0 } : undefined;
      this.combatRole = role;
    }
    const group = this.combatGroups[role];
    let lowerPose: LowerBodySample | undefined;
    const landing = !attack && p.state === 'land' && this.traversalGroups;
    if (!landing && this.combatLower?.state === 'land') this.traversalGroups?.land.stop(true);
    this.combatLower = null;
    const airPose = !landing && !p.grounded ? this.sampleAirLower(sim) : undefined;
    let landPose: PoseSnapshot[] | undefined;
    if (landing) {
      this.releaseAirLayer();
      const land = this.traversalGroups!.land, landTime = Math.max(0, Math.min(ruenEquippedTraversalProfile.duration.land, p.stateTime));
      this.sampleManual(land, land.from + landTime * land.targetedAnimations[0]!.animation.framePerSecond, 0);
      landPose = capturePose(land, isLowerBody); this.combatLower = { state: 'land', frame: land.getCurrentFrame(), time: landTime };
    } else if (p.grounded) this.releaseAirLayer();
    if (!attack && p.grounded && !landing) lowerPose = this.sampleGuardSteps(sim, dt, dx, dz, distance);
    this.sampleManual(group, group.from + time * group.targetedAnimations[0]!.animation.framePerSecond, 1);
    if (lowerPose) this.applyGuardSteps(lowerPose);
    this.combatTime = time; this.combatFrame = group.getCurrentFrame();
    this.combatEntryWeight = 1;
    if (this.combatEntry) {
      this.combatEntry.elapsed += dt;
      // The minimum damage windup is .14 s, so attack entry is finished well
      // before its active window. Controller timestamps remain authoritative.
      const progress = attack ? time / 0.06 : role === 'block' ? time / 0.035 : this.combatEntry.elapsed / 0.08;
      this.combatEntryWeight = smoothstep(progress);
      blendFromPose(this.combatEntry.from, this.combatEntryWeight);
      if (progress >= 1) this.combatEntry = undefined;
    }
    // Restore the complete airborne support pose after upper-body blending.
    if (airPose) restorePose(airPose);
    if (landPose) restorePose(landPose);
    this.fallback.root.setEnabled(false); this.loaded.root.setEnabled(true); this.equipmentView?.setEnabled(true);
    this.representation = 'meshy'; this.applyVisibility(sim);
    this.reason = !playing ? 'paused' : role === 'shield' ? 'guard' : role === 'block' ? 'block-reaction' : 'combat';
  }

  /** Manual groups stay paused: renderer speed cannot move their playhead. */
  private sampleManual(group: AnimationGroup, frame: number, weight: number): void {
    group.weight = weight;
    if (!group.isStarted) group.start(true, 0);
    group.pause(); group.speedRatio = 0;
    group.goToFrame(Math.max(group.from, Math.min(group.to, frame)));
  }

  private sampleGuardSteps(sim: Simulation, dt: number, dx: number, dz: number, distance: number, kind: 'walk' | 'run' = 'walk'): LowerBodySample | undefined {
    if (!this.groups) return undefined;
    const walk = this.groups[kind];
    this.groups[kind === 'walk' ? 'run' : 'walk'].stop(true);
    this.guardMoving = this.speed > 0.01;
    this.guardStride = Math.max(0, Math.min(1, this.guardStride + (this.guardMoving ? 1 : -1) * dt / 0.12));
    if (this.guardMoving && dt > 0) {
      let direction = Math.atan2(Math.sin(Math.atan2(dx, dz) - sim.player.yaw), Math.cos(Math.atan2(dx, dz) - sim.player.yaw));
      const backwards = Math.cos(direction) < 0;
      if (backwards) direction += direction > 0 ? -Math.PI : Math.PI;
      const delta = Math.atan2(Math.sin(direction - this.guardYaw), Math.cos(direction - this.guardYaw));
      this.guardYaw += delta * (1 - Math.exp(-dt * 12));
      const duration = (walk.to - walk.from) / walk.targetedAnimations[0]!.animation.framePerSecond;
      const phase = distance / (ruenMeshyProfile.referenceSpeed[kind] * duration) * (backwards ? -1 : 1);
      this.guardPhase = ((this.guardPhase + phase) % 1 + 1) % 1;
    }
    this.guardFrame = walk.from + this.guardPhase * (walk.to - walk.from);
    if (this.guardStride === 0) { walk.stop(true); return undefined; }
    this.sampleManual(walk, this.guardFrame, 0);
    return { pose: capturePose(walk, isLowerBody), support: this.captureSupport() };
  }

  private applyGuardSteps(lower: LowerBodySample, kind: 'walk' | 'run' = 'walk'): void {
    if (!this.loaded || !this.groups) return;
    const hips = this.loaded.container.transformNodes.find(node => node.name === 'mixamorig:Hips');
    const spine = this.loaded.container.transformNodes.find(node => node.name === 'mixamorig:Spine');
    const parent = hips?.parent as TransformNode | null;
    if (!hips?.rotationQuaternion || !spine?.rotationQuaternion || !parent || spine.parent !== hips) return;
    // Preserve the upper guard in world space while the pelvis and legs step.
    // The glTF parent contains a reflection; conjugating rotation matrices keeps
    // directional turns correct without decomposing that reflected parent.
    const upperWorld = spine.computeWorldMatrix(true).clone();
    const base = capturePose(this.groups[kind], isLowerBody), support = this.captureSupport();
    for (const [foot, height] of support) support.set(foot, height + ((lower.support.get(foot) ?? height) - height) * this.guardStride);
    restorePose(lower.pose); blendFromPose(base, this.guardStride);
    this.turnHips(this.guardYaw * this.guardStride);
    this.preserveSupport(support);
    const upperLocal = upperWorld.multiply(Matrix.Invert(hips.computeWorldMatrix(true)));
    upperLocal.decompose(spine.scaling, spine.rotationQuaternion, spine.position);
    spine.rotationQuaternion.normalize();
  }

  private applyVisibility(sim: Simulation): void {
    const visibility = sim.player.invulnerable > 0 && Math.sin(sim.age * 35) > 0 ? 0.4 : 1;
    for (const mesh of this.loaded?.container.meshes ?? []) mesh.visibility = visibility;
    for (const item of this.equipmentView?.models ?? []) for (const mesh of item.model.container.meshes) mesh.visibility = visibility;
  }

  private clearActions(): void {
    this.actionRole = null; this.actionTime = 0; this.actionFrame = null; this.actionEntry = undefined; this.actionEntryWeight = 1; this.actionMoving = false; this.actionBlockExit = undefined;
  }

  private clearDirectional(): void {
    this.directionalState = null; this.directionalPhase = this.directionalAngle = 0; this.directionalFrame = null;
    this.directionalWeights = zeroDirectionalWeights(); this.directionalClip = null; this.directionalEntry = undefined;
  }

  private clearTraversal(): void {
    this.traversalRole = null; this.traversalTime = 0; this.traversalFrame = null;
    this.traversalEntry = undefined; this.traversalEntryWeight = 1; this.traversalDirection = 0;
  }

  private clearCombat(): void {
    this.combatRole = null; this.combatTime = 0; this.combatFrame = null; this.combatEntry = undefined; this.combatEntryWeight = 1;
    this.blockStart = undefined; this.guardElapsed = this.guardPhase = this.guardStride = this.guardYaw = this.guardFrame = 0;
    this.guardMoving = false; this.combatLower = null;
  }

  private select(kind: Locomotion): void {
    if (!this.groups) return;
    const incoming = this.groups[kind];
    if (!this.target) {
      this.blendWeights = zeroWeights(); this.blendWeights[kind] = 1;
      incoming.weight = this.exitTransition ? 0 : 1;
      incoming.start(true, 0);
      if (this.exitTransition) seekForBlend(incoming, incoming.from + (kind === 'idle' ? 0 : this.exitTransition.phase ?? 0) * (incoming.to - incoming.from));
      else incoming.goToFrame(incoming.from);
    } else {
      if (!incoming.isStarted) {
        const outgoing = this.groups[this.target];
        // Match foot-cycle phase only between the two gaits, not to breathing.
        const phase = kind !== 'idle' && this.target !== 'idle' ?
          Math.max(0, Math.min(1, (outgoing.getCurrentFrame() - outgoing.from) / (outgoing.to - outgoing.from))) : 0;
        const visible = this.exitTransition ? capturePose(incoming) : undefined;
        if (this.exitTransition) restorePose(this.exitTransition.from);
        incoming.weight = 0; incoming.start(true, 0);
        seekForBlend(incoming, incoming.from + phase * (incoming.to - incoming.from));
        if (visible) restorePose(visible);
      }
      this.transition = { startWeights: this.weights, elapsed: 0 };
    }
    this.target = kind;
  }

  private resetClips(): void {
    this.loaded?.player.stopAll();
    for (const group of this.ownedGroups()) group.weight = 0;
    this.airborne = null;
    this.blendWeights = zeroWeights(); this.target = null; this.transition = undefined;
    this.exitTransition = undefined;
  }

  private showFallback(reason: string): void {
    this.loaded?.root.setEnabled(false); this.equipmentView?.setEnabled(false);
    this.resetClips(); this.clearCombat(); this.clearTraversal(); this.clearActions(); this.clearDirectional();
    this.fallback.root.setEnabled(true);
    this.representation = 'fallback'; this.reason = reason;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.onAfterAnimationsObservable.removeCallback(this.preserveStoppingSupport);
    this.restSupport.clear();
    this.sampleSoles = undefined;
    this.equipmentView?.dispose(); this.equipmentView = undefined;
    this.loadingModel?.dispose(); this.loadingModel = undefined;
    this.loaded?.dispose(); this.loaded = undefined; this.groups = undefined; this.combatGroups = undefined; this.traversalGroups = undefined; this.actionGroups = undefined; this.directionalGroups = undefined; this.clearCombat(); this.clearTraversal(); this.clearActions(); this.clearDirectional();
    if (!this.fallback.root.isDisposed()) this.fallback.root.setEnabled(true);
  }
}
