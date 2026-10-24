export type RuenEquipmentKind = 'sword' | 'shield';

export interface RuenEquipmentProfile {
  kind: RuenEquipmentKind;
  label: string;
  path: string;
  hand: 'mixamorig:RightHand' | 'mixamorig:LeftHand';
  uniformScale: number;
  /** Grip in the loaded asset's exterior-root coordinates, including glTF conversion. */
  grip: readonly [number, number, number];
  handOffset: readonly [number, number, number];
  /** Euler XYZ rotation of the exterior mount, in radians. */
  rotation: readonly [number, number, number];
}

/** Original files stay intact; fitting is applied only to exterior mount nodes. */
export const ruenEquipmentProfiles: readonly RuenEquipmentProfile[] = [
  {
    kind: 'sword', label: 'Azure Oathblade',
    path: 'assets/models/ruen/equipment/Meshy_AI_Azure_Oathblade_1022220336_texture.glb',
    hand: 'mixamorig:RightHand', uniformScale: 0.55,
    // The shaft crosses the curled fingers instead of following the forearm.
    // Contact center measured inside the original rig's closed right palm.
    grip: [0.000373, 0.65, -0.000586], handOffset: [-0.016, 0.108, -0.006],
    rotation: [1.2958286119, 0.1583958728, -2.5621306834],
  },
  {
    kind: 'shield', label: 'Aegis of the Azure',
    path: 'assets/models/ruen/equipment/Meshy_AI_Aegis_of_the_Azure_St_1022222231_texture.glb',
    // Uniform 30% reduction around the grip: the handle stays in the palm.
    hand: 'mixamorig:LeftHand', uniformScale: 0.42 * 0.7,
    // The rear handle also runs along asset Y, across the left fist.
    grip: [0.000351, 0.125, -0.275346], handOffset: [0.018, 0.106, -0.008],
    rotation: [-1.3327211270, 2.8231938173, 0.7433159683],
  },
];

/** The game uses optimized copies with the same origin, axes and grip points. */
export const ruenRuntimeEquipmentProfiles: readonly RuenEquipmentProfile[] = ruenEquipmentProfiles.map(profile => ({
  ...profile,
  path: `assets/models/ruen/equipment/runtime/${profile.kind === 'sword' ? 'azure-oathblade' : 'aegis-of-the-azure'}.glb`,
}));
