import type { Scene } from '@babylonjs/core/scene';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import type { Simulation, Player } from '../core/Simulation';
import type { CharacterRig } from './characters';
import { assetUrl } from './assetCatalog';
import { loadInspectionModel, type InspectionModel } from './inspectModel';

type Locomotion = 'walk' | 'run';
type LoadStatus = 'loading' | 'ready' | 'error';
type Weights = Record<Locomotion, number>;

export const ruenMeshyProfile = {
  path: 'assets/models/ruen/Meshy_AI_Crimson_Gemwarden_All_Animations.glb',
  scale: 1.45 / 1.70,
  crossfadeSeconds: 0.2,
  // Initial estimates from backward toe velocity in the real clips, scaled to
  // the existing 1.45-unit controller. They are visual tuning, not movement rules.
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
  clips: { name: string; isPlaying: boolean; isStarted: boolean; weight: number; speedRatio: number; frame: number }[];
}

/** Opt-in visual test only. No input, damage, root motion or controller writes. */
export class RuenLocomotionView {
  /** Exterior adjustment only; authored bone translation remains intact. */
  groundOffset = 0;
  private loaded: InspectionModel | undefined;
  private loadState: LoadStatus = 'loading';
  private loadError: string | undefined;
  private pending: Promise<void> | undefined;
  private disposed = false;
  private groups: Record<Locomotion, AnimationGroup> | undefined;
  private sample: MotionSample | undefined;
  private movementDirection: { x: number; z: number } | undefined;
  private directionTarget: string | null = null;
  private speed = 0;
  private blendWeights: Weights = { walk: 0, run: 0 };
  private target: Locomotion | null = null;
  private transition: { startRunWeight: number; elapsed: number } | undefined;
  private representation: 'meshy' | 'fallback' = 'fallback';
  private reason = 'loading';

  constructor(private readonly scene: Scene, private readonly fallback: CharacterRig) {}

  get model(): InspectionModel | undefined { return this.loaded; }
  get status(): LoadStatus { return this.loadState; }
  get error(): string | undefined { return this.loadError; }
  get actualSpeed(): number { return this.speed; }
  get weights(): Weights { return { ...this.blendWeights }; }
  get activeClip(): string | null { return this.target ? this.groups?.[this.target].name ?? null : null; }
  get diagnostics(): RuenLocomotionDiagnostics {
    return {
      status: this.loadState, representation: this.representation, reason: this.reason,
      speed: this.speed, weights: this.weights,
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
    try {
      model = await loadInspectionModel(assetUrl(ruenMeshyProfile.path), this.scene);
      if (this.disposed || this.scene.isDisposed) { model.dispose(); return; }
      model.root.setEnabled(false);
      model.player.stopAll();
      const find = (name: string): AnimationGroup => {
        const matches = model!.container.animationGroups.filter(group => group.name === name);
        const group = matches[0];
        if (matches.length !== 1 || !group || group.to <= group.from || !group.targetedAnimations.length) {
          throw new Error(`Se requiere un clip válido y único «${name}».`);
        }
        return group;
      };
      const walk = find('Walking'), run = find('Running');
      model.root.name = 'ruen-meshy-visual';
      model.root.scaling.setAll(ruenMeshyProfile.scale);
      // Keep the glTF conversion node and every joint beneath this exterior root.
      // It is deliberately NOT parented to the procedural rig's animated root.
      this.groups = { walk, run };
      walk.weight = run.weight = 0;
      this.loaded = model; this.loadState = 'ready'; this.reason = 'awaiting-controller';
    } catch (error) {
      model?.dispose();
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
    // Respawn replaces Player, new game replaces Simulation. The distance guard
    // catches external/checkpoint teleports without borrowing desired vx/vz.
    const reset = !previous || previous.sim !== sim || previous.player !== p || elapsed < 0 || elapsed > 0.5 ||
      (elapsed === 0 && distance > 0.000001) ||
      distance > Math.max(0.75, elapsed * 12);
    const dt = !reset && playing && sim.mode === 'playing' && elapsed > 0 ? elapsed : 0;
    // A 120 Hz render may have no new 60 Hz simulation sample. Keep its last
    // measured rate; an explicit paused menu must instead freeze animation.
    if (reset || !playing || sim.mode !== 'playing') this.speed = 0;
    else if (dt > 0) this.speed = distance / dt;
    if (reset || !sim.targetId || this.directionTarget !== sim.targetId) this.movementDirection = undefined;
    this.directionTarget = sim.targetId;
    if (sim.targetId && dt > 0 && distance > 0.0001) this.movementDirection = { x: dx / distance, z: dz / distance };
    if (!this.loaded || !this.groups) { this.showFallback(this.loadState === 'error' ? 'load-error' : 'loading'); return; }

    this.loaded.root.position.set(p.x, p.y + this.groundOffset, p.z);
    this.loaded.root.rotation.set(0, p.yaw, 0);
    const kind = p.state === 'walk' || p.state === 'run' ? p.state : null;
    if (!kind || !p.grounded || p.shield || p.attackTime >= 0 || p.health <= 0 || sim.mode !== 'playing') {
      this.showFallback(`unsupported-state:${p.state}`); return;
    }
    // The clips are forward locomotion. Do not silently reuse them for lock-on
    // strafing/backpedaling; the existing rig remains the explicit test fallback.
    if (sim.targetId && this.movementDirection &&
      this.movementDirection.x * Math.sin(p.yaw) + this.movementDirection.z * Math.cos(p.yaw) < Math.cos(Math.PI / 4)) {
      this.showFallback('unsupported-direction'); return;
    }

    this.fallback.root.setEnabled(false); this.loaded.root.setEnabled(true);
    this.representation = 'meshy';
    if (this.target !== kind) this.select(kind);
    const moving = playing && !reset && this.speed > 0.01;
    if (moving && this.transition) {
      this.transition.elapsed += dt;
      const t = this.transition.elapsed >= ruenMeshyProfile.crossfadeSeconds - 1e-8 ? 1 :
        this.transition.elapsed / ruenMeshyProfile.crossfadeSeconds;
      const eased = t * t * (3 - 2 * t);
      const destination = kind === 'run' ? 1 : 0;
      this.blendWeights.run = this.transition.startRunWeight + (destination - this.transition.startRunWeight) * eased;
      this.blendWeights.walk = 1 - this.blendWeights.run;
      if (t === 1) { this.blendWeights = { walk: 1 - destination, run: destination }; this.transition = undefined; }
    }
    for (const key of ['walk', 'run'] as const) {
      const group = this.groups[key];
      group.weight = this.blendWeights[key];
      // Both ratios are dimensionless. Babylon advances wall time; the clock
      // ratio honors the controller's 100 ms cap on slow frames without a second dt.
      group.speedRatio = this.speed / ruenMeshyProfile.referenceSpeed[key] * playbackTimeScale;
      if (group.weight === 0 && !this.transition) group.stop(true);
      else if (moving) { if (!group.isPlaying) group.play(true); }
      else group.pause();
    }
    for (const mesh of this.loaded.container.meshes) {
      mesh.visibility = p.invulnerable > 0 && Math.sin(sim.age * 35) > 0 ? 0.4 : 1;
    }
    this.reason = !playing ? 'paused' : reset ? 'controller-reset' : dt === 0 ? 'no-simulation-step' :
      !moving ? 'controller-stationary' : this.transition ? 'crossfade' : 'locomotion';
  }

  private select(kind: Locomotion): void {
    if (!this.groups) return;
    const incoming = this.groups[kind];
    if (!this.target) {
      this.blendWeights = { walk: kind === 'walk' ? 1 : 0, run: kind === 'run' ? 1 : 0 };
      incoming.weight = 1;
      incoming.start(true, 0); incoming.goToFrame(incoming.from, true);
    } else {
      if (!incoming.isStarted) {
        const outgoing = this.groups[this.target];
        const phase = Math.max(0, Math.min(1, (outgoing.getCurrentFrame() - outgoing.from) / (outgoing.to - outgoing.from)));
        incoming.weight = 0;
        incoming.start(true, 0);
        incoming.goToFrame(incoming.from + phase * (incoming.to - incoming.from), true);
      }
      this.transition = { startRunWeight: this.blendWeights.run, elapsed: 0 };
    }
    this.target = kind;
  }

  private showFallback(reason: string): void {
    this.loaded?.root.setEnabled(false);
    this.loaded?.player.stopAll();
    this.fallback.root.setEnabled(true);
    this.blendWeights = { walk: 0, run: 0 }; this.target = null; this.transition = undefined;
    this.representation = 'fallback'; this.reason = reason;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loaded?.dispose(); this.loaded = undefined; this.groups = undefined;
    if (!this.fallback.root.isDisposed()) this.fallback.root.setEnabled(true);
  }
}
