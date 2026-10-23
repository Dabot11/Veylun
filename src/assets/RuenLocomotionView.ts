import type { Scene } from '@babylonjs/core/scene';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Simulation, Player } from '../core/Simulation';
import type { CharacterRig } from './characters';
import { assetUrl } from './assetCatalog';
import { loadInspectionModel, type InspectionModel } from './inspectModel';
import { RuenEquipmentPreview, type RuenEquipmentDiagnostics } from './RuenEquipmentPreview';
import { ruenRuntimeEquipmentProfiles } from './ruenEquipmentProfile';
import { createRuenEquippedLocomotion } from './ruenEquippedLocomotion';

type Locomotion = 'idle' | 'walk' | 'run';
type LoadStatus = 'loading' | 'ready' | 'error';
type Weights = Record<Locomotion, number>;
const states = ['idle', 'walk', 'run'] as const;
const zeroWeights = (): Weights => ({ idle: 0, walk: 0, run: 0 });

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
  get activeClip(): string | null { return this.target ? this.groups?.[this.target].name ?? null : null; }
  get diagnostics(): RuenLocomotionDiagnostics {
    return {
      status: this.loadState, representation: this.representation, reason: this.reason,
      speed: this.speed, weights: this.weights,
      equipped: this.equipmentView?.diagnostics.status === 'ready',
      equipment: this.equipmentView?.diagnostics ?? null,
      clips: this.groups ? Object.values(this.groups).map(group => ({
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
      model.root.name = 'ruen-meshy-visual';
      model.root.scaling.setAll(ruenMeshyProfile.scale);
      // Keep the glTF conversion and all hand-mounted assets under this independent root.
      // Never parent it to the procedural rig's animated root.
      for (const group of Object.values(groups)) group.weight = 0;
      this.loaded = model; this.loadingModel = undefined; this.loadState = 'ready'; this.reason = 'awaiting-controller';
    } catch (error) {
      equipment?.dispose(); this.equipmentView = undefined;
      if (model && !model.root.isDisposed()) model.dispose();
      this.loaded = undefined; this.loadingModel = undefined; this.groups = undefined;
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
    const kind = states.find(state => state === p.state);
    if (!kind || !p.grounded || p.shield || p.attackTime >= 0 || p.health <= 0 || sim.mode !== 'playing') {
      this.showFallback(`unsupported-state:${p.state}`); return;
    }
    // Forward clips are not reused for lock-on strafing or backpedaling.
    if (kind !== 'idle' && sim.targetId && this.movementDirection &&
      this.movementDirection.x * Math.sin(p.yaw) + this.movementDirection.z * Math.cos(p.yaw) < Math.cos(Math.PI / 4)) {
      this.showFallback('unsupported-direction'); return;
    }

    if (reset || this.representation !== 'meshy') this.resetClips();
    if (this.target !== kind) this.select(kind);
    this.fallback.root.setEnabled(false); this.loaded.root.setEnabled(true);
    this.equipmentView?.setEnabled(this.equipmentView.diagnostics.status === 'ready');
    this.representation = 'meshy';
    const visibility = p.invulnerable > 0 && Math.sin(sim.age * 35) > 0 ? 0.4 : 1;
    for (const mesh of this.loaded.container.meshes) mesh.visibility = visibility;
    for (const item of this.equipmentView?.models ?? []) for (const mesh of item.model.container.meshes) mesh.visibility = visibility;
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
    for (const key of states) {
      const group = this.groups[key];
      group.weight = this.blendWeights[key];
      // Idle breathes at its authored rate. Gaits advance only by actual movement.
      // Babylon uses wall time; this ratio honors the existing simulation-time cap.
      group.speedRatio = (key === 'idle' ? 1 : this.speed / ruenMeshyProfile.referenceSpeed[key]) * clockRatio;
      if (group.weight === 0 && (!this.transition || !group.isStarted)) group.stop(true);
      else if (animate) { if (!group.isPlaying) group.play(true); }
      else group.pause();
    }
    this.reason = !playing || clockRatio === 0 ? 'paused' : reset ? 'controller-reset' : dt === 0 ? 'no-simulation-step' :
      !animate ? 'controller-stationary' : this.transition ? 'crossfade' : kind === 'idle' ? 'idle-animation' : 'locomotion';
  }

  private select(kind: Locomotion): void {
    if (!this.groups) return;
    const incoming = this.groups[kind];
    if (!this.target) {
      this.blendWeights = zeroWeights(); this.blendWeights[kind] = 1;
      incoming.weight = 1; incoming.start(true, 0); incoming.goToFrame(incoming.from);
    } else {
      if (!incoming.isStarted) {
        const outgoing = this.groups[this.target];
        // Match foot-cycle phase only between the two gaits, not to breathing.
        const phase = kind !== 'idle' && this.target !== 'idle' ?
          Math.max(0, Math.min(1, (outgoing.getCurrentFrame() - outgoing.from) / (outgoing.to - outgoing.from))) : 0;
        incoming.weight = 0; incoming.start(true, 0);
        seekForBlend(incoming, incoming.from + phase * (incoming.to - incoming.from));
      }
      this.transition = { startWeights: this.weights, elapsed: 0 };
    }
    this.target = kind;
  }

  private resetClips(): void {
    this.loaded?.player.stopAll();
    if (this.groups) for (const group of Object.values(this.groups)) group.weight = 0;
    this.blendWeights = zeroWeights(); this.target = null; this.transition = undefined;
  }

  private showFallback(reason: string): void {
    this.loaded?.root.setEnabled(false); this.equipmentView?.setEnabled(false);
    this.resetClips();
    this.fallback.root.setEnabled(true);
    this.representation = 'fallback'; this.reason = reason;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.equipmentView?.dispose(); this.equipmentView = undefined;
    this.loadingModel?.dispose(); this.loadingModel = undefined;
    this.loaded?.dispose(); this.loaded = undefined; this.groups = undefined;
    if (!this.fallback.root.isDisposed()) this.fallback.root.setEnabled(true);
  }
}
