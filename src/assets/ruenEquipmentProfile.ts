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
    grip: [0.000373, 0.65, -0.000586], handOffset: [0, 0.05, 0],
    rotation: [0.1003138816, -0.4090243679, -2.9653931856],
  },
  {
    kind: 'shield', label: 'Aegis of the Azure',
    path: 'assets/models/ruen/equipment/Meshy_AI_Aegis_of_the_Azure_St_1022222231_texture.glb',
    hand: 'mixamorig:LeftHand', uniformScale: 0.42,
    grip: [0.000351, 0.125, -0.275346], handOffset: [0, 0.05, 0],
    rotation: [-1.4497777416, 2.0538441591, 1.0377765256],
  },
];
