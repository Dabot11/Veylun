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
import { attacks } from '../player/combat';

type Locomotion = 'idle' | 'walk' | 'run';
type LoadStatus = 'loading' | 'ready' | 'error';
type Weights = Record<Locomotion, number>;
type CombatRole = 'shield' | 'block' | 'attack1' | 'attack2' | 'attack3';
type CombatGroups = Record<CombatRole, AnimationGroup>;
type PoseValue = Vector3 | Quaternion | number;
interface PoseSnapshot { owner: Record<string, unknown>; key: string; value: PoseValue }
const states = ['idle', 'walk', 'run'] as const;
const zeroWeights = (): Weights => ({ idle: 0, walk: 0, run: 0 });

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
    entryWeight: number; guardMoving: boolean; guardDirection: number; guardFrame: number; error: string | null;
  };
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
  private combatError: string | null = null;
  private combatRole: CombatRole | null = null;
  private combatTime = 0;
  private combatFrame: number | null = null;
  private combatEntry: { from: PoseSnapshot[]; elapsed: number } | undefined;
  private combatEntryWeight = 1;
  private exitTransition: { from: PoseSnapshot[]; elapsed: number } | undefined;
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

  constructor(private readonly scene: Scene, private readonly fallback: CharacterRig) {}

  get model(): InspectionModel | undefined { return this.loaded; }
  get equipment(): RuenEquipmentPreview | undefined { return this.equipmentView; }
  get status(): LoadStatus { return this.loadState; }
  get error(): string | undefined { return this.loadError; }
  get actualSpeed(): number { return this.speed; }
  get weights(): Weights { return { ...this.blendWeights }; }
  get activeClip(): string | null { return this.combatRole ? this.combatGroups?.[this.combatRole].name ?? null : this.target ? this.groups?.[this.target].name ?? null : null; }
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
        entryWeight: this.combatEntryWeight, guardMoving: this.guardMoving, guardDirection: this.guardYaw,
        guardFrame: this.guardFrame, error: this.combatError,
      },
      clips: this.groups ? [...Object.values(this.groups), ...Object.values(this.combatGroups ?? {})].map(group => ({
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
    if (this.disposed || !this.combatGroups || sim.mode !== 'playing' || p.state !== 'shield' ||
      !p.shield || !p.grounded || p.attackTime >= 0 || p.health <= 0 || !Number.isFinite(sim.age)) return;
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
      }
      model.root.name = 'ruen-meshy-visual';
      model.root.scaling.setAll(ruenMeshyProfile.scale);
      // Keep the glTF conversion and all hand-mounted assets under this independent root.
      // Never parent it to the procedural rig's animated root.
      for (const group of [...Object.values(groups), ...Object.values(this.combatGroups ?? {})]) group.weight = 0;
      this.loaded = model; this.loadingModel = undefined; this.loadState = 'ready'; this.reason = 'awaiting-controller';
    } catch (error) {
      equipment?.dispose(); this.equipmentView = undefined;
      if (model && !model.root.isDisposed()) model.dispose();
      this.loaded = undefined; this.loadingModel = undefined; this.groups = undefined; this.combatGroups = undefined;
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
    if (reset) this.clearCombat();
    const attack = p.state === 'attack1' || p.state === 'attack2' || p.state === 'attack3' ? p.state : null;
    const guarding = p.state === 'shield' && p.shield && p.attackTime < 0;
    if (this.combatGroups && p.grounded && p.health > 0 && sim.mode === 'playing' &&
      (guarding || attack && Number.isFinite(p.attackTime) && p.attackTime >= 0 && p.combo === Number(attack.slice(-1)))) {
      this.showCombat(sim, attack, dt, dx, dz, distance, reset, playing);
      return;
    }
    this.blockStart = undefined;
    const kind = states.find(state => state === p.state);
    if (!kind || !p.grounded || p.shield || p.attackTime >= 0 || p.health <= 0 || sim.mode !== 'playing') {
      this.showFallback(`unsupported-state:${p.state}`); return;
    }
    // Forward clips are not reused for lock-on strafing or backpedaling.
    if (kind !== 'idle' && sim.targetId && this.movementDirection &&
      this.movementDirection.x * Math.sin(p.yaw) + this.movementDirection.z * Math.cos(p.yaw) < Math.cos(Math.PI / 4)) {
      this.showFallback('unsupported-direction'); return;
    }

    if (this.combatRole) {
      const from = capturePose(this.groups.idle);
      this.resetClips(); this.clearCombat();
      restorePose(from); this.exitTransition = { from, elapsed: 0 };
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

  private showCombat(
    sim: Simulation, attack: 'attack1' | 'attack2' | 'attack3' | null,
    dt: number, dx: number, dz: number, distance: number, reset: boolean, playing: boolean,
  ): void {
    if (!this.groups || !this.combatGroups || !this.loaded) return;
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
    let lowerPose: PoseSnapshot[] | undefined;
    if (!attack) lowerPose = this.sampleGuardSteps(sim, dt, dx, dz, distance);
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

  private sampleGuardSteps(sim: Simulation, dt: number, dx: number, dz: number, distance: number): PoseSnapshot[] | undefined {
    if (!this.groups) return undefined;
    const walk = this.groups.walk;
    this.guardMoving = this.speed > 0.01;
    this.guardStride = Math.max(0, Math.min(1, this.guardStride + (this.guardMoving ? 1 : -1) * dt / 0.12));
    if (this.guardMoving && dt > 0) {
      let direction = Math.atan2(Math.sin(Math.atan2(dx, dz) - sim.player.yaw), Math.cos(Math.atan2(dx, dz) - sim.player.yaw));
      const backwards = Math.cos(direction) < 0;
      if (backwards) direction += direction > 0 ? -Math.PI : Math.PI;
      const delta = Math.atan2(Math.sin(direction - this.guardYaw), Math.cos(direction - this.guardYaw));
      this.guardYaw += delta * (1 - Math.exp(-dt * 12));
      const duration = (walk.to - walk.from) / walk.targetedAnimations[0]!.animation.framePerSecond;
      const phase = distance / (ruenMeshyProfile.referenceSpeed.walk * duration) * (backwards ? -1 : 1);
      this.guardPhase = ((this.guardPhase + phase) % 1 + 1) % 1;
    }
    this.guardFrame = walk.from + this.guardPhase * (walk.to - walk.from);
    if (this.guardStride === 0) { walk.stop(true); return undefined; }
    this.sampleManual(walk, this.guardFrame, 0);
    return capturePose(walk, node => /^mixamorig:(Hips|(Left|Right)(UpLeg|Leg|Foot|ToeBase|Toe_End))$/.test(node.name));
  }

  private applyGuardSteps(lower: PoseSnapshot[]): void {
    if (!this.loaded || !this.groups) return;
    const hips = this.loaded.container.transformNodes.find(node => node.name === 'mixamorig:Hips');
    const spine = this.loaded.container.transformNodes.find(node => node.name === 'mixamorig:Spine');
    const parent = hips?.parent as TransformNode | null;
    if (!hips?.rotationQuaternion || !spine?.rotationQuaternion || !parent || spine.parent !== hips) return;
    // Preserve the upper guard in world space while the pelvis and legs step.
    // The glTF parent contains a reflection; conjugating rotation matrices keeps
    // directional turns correct without decomposing that reflected parent.
    const upperWorld = spine.computeWorldMatrix(true).clone();
    const base = capturePose(this.groups.walk, node => /^mixamorig:(Hips|(Left|Right)(UpLeg|Leg|Foot|ToeBase|Toe_End))$/.test(node.name));
    restorePose(lower); blendFromPose(base, this.guardStride);
    const parentBasis = parent.computeWorldMatrix(true).clone(); parentBasis.setTranslation(Vector3.Zero());
    const turn = parentBasis.multiply(Matrix.RotationY(this.guardYaw * this.guardStride)).multiply(Matrix.Invert(parentBasis));
    const localRotation = Matrix.Compose(Vector3.One(), hips.rotationQuaternion, Vector3.Zero()).multiply(turn);
    hips.rotationQuaternion.copyFrom(Quaternion.FromRotationMatrix(localRotation).normalize());
    const upperLocal = upperWorld.multiply(Matrix.Invert(hips.computeWorldMatrix(true)));
    upperLocal.decompose(spine.scaling, spine.rotationQuaternion, spine.position);
    spine.rotationQuaternion.normalize();
  }

  private applyVisibility(sim: Simulation): void {
    const visibility = sim.player.invulnerable > 0 && Math.sin(sim.age * 35) > 0 ? 0.4 : 1;
    for (const mesh of this.loaded?.container.meshes ?? []) mesh.visibility = visibility;
    for (const item of this.equipmentView?.models ?? []) for (const mesh of item.model.container.meshes) mesh.visibility = visibility;
  }

  private clearCombat(): void {
    this.combatRole = null; this.combatTime = 0; this.combatFrame = null; this.combatEntry = undefined; this.combatEntryWeight = 1;
    this.blockStart = undefined; this.guardElapsed = this.guardPhase = this.guardStride = this.guardYaw = this.guardFrame = 0;
    this.guardMoving = false;
  }

  private select(kind: Locomotion): void {
    if (!this.groups) return;
    const incoming = this.groups[kind];
    if (!this.target) {
      this.blendWeights = zeroWeights(); this.blendWeights[kind] = 1;
      incoming.weight = this.exitTransition ? 0 : 1;
      incoming.start(true, 0);
      if (this.exitTransition) seekForBlend(incoming, incoming.from);
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
    if (this.groups) for (const group of [...Object.values(this.groups), ...Object.values(this.combatGroups ?? {})]) group.weight = 0;
    this.blendWeights = zeroWeights(); this.target = null; this.transition = undefined;
    this.exitTransition = undefined;
  }

  private showFallback(reason: string): void {
    this.loaded?.root.setEnabled(false); this.equipmentView?.setEnabled(false);
    this.resetClips(); this.clearCombat();
    this.fallback.root.setEnabled(true);
    this.representation = 'fallback'; this.reason = reason;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.equipmentView?.dispose(); this.equipmentView = undefined;
    this.loadingModel?.dispose(); this.loadingModel = undefined;
    this.loaded?.dispose(); this.loaded = undefined; this.groups = undefined; this.combatGroups = undefined; this.clearCombat();
    if (!this.fallback.root.isDisposed()) this.fallback.root.setEnabled(true);
  }
}
