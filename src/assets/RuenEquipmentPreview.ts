import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { assetUrl } from './assetCatalog';
import { loadInspectionModel, type InspectionModel, type InspectionReport } from './inspectModel';
import { ruenEquipmentProfiles, type RuenEquipmentKind, type RuenEquipmentProfile } from './ruenEquipmentProfile';

type PreviewStatus = 'idle' | 'loading' | 'ready' | 'partial' | 'error' | 'disposed';
type ItemStatus = 'idle' | 'loading' | 'ready' | 'error' | 'disposed';

export interface RuenEquipmentItem {
  readonly kind: RuenEquipmentKind;
  readonly model: InspectionModel;
  readonly mount: TransformNode;
}

interface EquipmentEntry {
  profile: RuenEquipmentProfile;
  status: ItemStatus;
  error: string | null;
  model?: InspectionModel;
  mount?: TransformNode;
}

export interface RuenEquipmentDiagnostics {
  status: PreviewStatus;
  enabled: boolean;
  items: { kind: RuenEquipmentKind; status: ItemStatus; error: string | null }[];
}

export interface RuenEquipmentPreviewReport {
  status: PreviewStatus;
  enabled: boolean;
  items: (RuenEquipmentProfile & { status: ItemStatus; error: string | null; inventory: InspectionReport | null })[];
}

/** Shared visual attachment loader: no animation, controller or combat writes. */
export class RuenEquipmentPreview {
  private state: PreviewStatus = 'idle';
  private enabled = true;
  private pending: Promise<void> | undefined;
  private readonly entries: EquipmentEntry[];

  constructor(private readonly scene: Scene, private readonly heroModel: InspectionModel,
    profiles: readonly RuenEquipmentProfile[] = ruenEquipmentProfiles) {
    this.entries = profiles.map(profile => ({ profile, status: 'idle', error: null }));
  }

  get models(): readonly RuenEquipmentItem[] {
    return this.entries.flatMap(entry => entry.model && entry.mount ? [{ kind: entry.profile.kind, model: entry.model, mount: entry.mount }] : []);
  }

  get diagnostics(): RuenEquipmentDiagnostics {
    return {
      status: this.state, enabled: this.enabled,
      items: this.entries.map(entry => ({ kind: entry.profile.kind, status: entry.status, error: entry.error })),
    };
  }

  /** Separate inventory; the hero's original report and container stay intact. */
  get report(): RuenEquipmentPreviewReport {
    return {
      status: this.state, enabled: this.enabled,
      items: this.entries.map(entry => ({
        ...entry.profile,
        grip: [...entry.profile.grip], handOffset: [...entry.profile.handOffset], rotation: [...entry.profile.rotation],
        status: entry.status, error: entry.error,
        inventory: entry.model ? structuredClone(entry.model.report) : null,
      })),
    };
  }

  /** One load per instance. Partial failures remain inspectable until disposal. */
  async load(): Promise<void> {
    if (this.pending) return this.pending;
    if (this.state !== 'idle') return;
    this.state = 'loading';
    this.pending = this.loadAll();
    try { await this.pending; } finally { this.pending = undefined; }
  }

  private async loadAll(): Promise<void> {
    const results = await Promise.allSettled(this.entries.map(entry => this.loadItem(entry)));
    if (this.state === 'disposed') return;
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const entry = this.entries[index]!;
        entry.status = 'error';
        entry.error = result.reason instanceof Error ? result.reason.message : String(result.reason);
      }
    });
    const ready = this.entries.filter(entry => entry.status === 'ready').length;
    this.state = ready === this.entries.length ? 'ready' : ready > 0 ? 'partial' : 'error';
  }

  private findHand(name: RuenEquipmentProfile['hand']): TransformNode {
    if (this.scene.isDisposed || this.heroModel.root.isDisposed() || this.heroModel.root.getScene() !== this.scene) {
      throw new Error('El modelo de Ruen no está disponible en esta escena.');
    }
    const skeleton = this.heroModel.container.skeletons[0];
    if (this.heroModel.container.skeletons.length !== 1 || !skeleton || skeleton.name !== 'SmartRigArmature' ||
      skeleton.bones.length !== 80 || new Set(skeleton.bones.map(bone => bone.name)).size !== 80) {
      throw new Error('El equipo requiere el rig original SmartRigArmature de 80 huesos únicos.');
    }
    const bone = skeleton.bones.find(candidate => candidate.name === name);
    const hand = bone?.getTransformNode();
    const matches = this.heroModel.container.transformNodes.filter(node => node.name === name);
    if (!hand || hand.isDisposed() || hand.getScene() !== this.scene || matches.length !== 1 || matches[0] !== hand ||
      !hand.isDescendantOf(this.heroModel.root)) {
      throw new Error(`No se encontró una articulación única y enlazada «${name}».`);
    }
    return hand;
  }

  private async loadItem(entry: EquipmentEntry): Promise<void> {
    entry.status = 'loading';
    const profile = entry.profile;
    const hand = this.findHand(profile.hand);
    if (!(profile.uniformScale > 0) || ![profile.uniformScale, ...profile.grip, ...profile.handOffset, ...profile.rotation].every(Number.isFinite)) {
      throw new Error(`El montaje de «${profile.label}» contiene un ajuste no válido.`);
    }
    let model: InspectionModel | undefined, mount: TransformNode | undefined;
    try {
      model = await loadInspectionModel(assetUrl(profile.path), this.scene);
      if (this.state === 'disposed') { model.dispose(); return; }
      if (this.scene.isDisposed || this.heroModel.root.isDisposed() || hand.isDisposed()) {
        throw new Error('La escena o la mano de Ruen se cerró durante la carga.');
      }
      if (model.root.getScene() !== this.scene || model.root.isDisposed()) {
        throw new Error(`El modelo de «${profile.label}» no está disponible en esta escena.`);
      }
      model.root.setEnabled(false);
      model.player.stopAll();
      mount = new TransformNode(`ruen-equipment-${profile.kind}-mount`, this.scene);
      mount.setEnabled(false);
      mount.parent = hand;
      mount.position.set(...profile.handOffset);
      mount.rotation.set(...profile.rotation);
      mount.scaling.setAll(profile.uniformScale);
      model.root.name = `ruen-equipment-${profile.kind}-visual`;
      model.root.parent = mount;
      // The grip is expressed after the asset's preserved glTF conversion node.
      // Translating only the exterior root places that point at the mount origin.
      model.root.position.set(-profile.grip[0], -profile.grip[1], -profile.grip[2]);
      model.root.setEnabled(true);
      entry.model = model; entry.mount = mount; entry.status = 'ready';
      mount.setEnabled(this.enabled);
    } catch (error) {
      model?.dispose();
      if (mount && !mount.isDisposed()) mount.dispose();
      throw error;
    }
  }

  setEnabled(enabled: boolean): void {
    if (this.state === 'disposed') return;
    this.enabled = enabled;
    for (const entry of this.entries) entry.mount?.setEnabled(enabled);
  }

  dispose(): void {
    if (this.state === 'disposed') return;
    this.state = 'disposed'; this.enabled = false;
    for (const entry of this.entries) {
      entry.model?.dispose();
      if (entry.mount && !entry.mount.isDisposed()) entry.mount.dispose();
      delete entry.model; delete entry.mount;
      entry.status = 'disposed';
    }
  }
}
