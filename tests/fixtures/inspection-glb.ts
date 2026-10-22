/** A tiny, deliberately synthetic loader fixture. This is NOT the Meshy/Ruen asset. */
export function inspectionGlb(): Buffer {
  const chunks: Buffer[] = [];
  const bufferViews: { buffer: number; byteOffset: number; byteLength: number }[] = [];
  const accessors: Record<string, unknown>[] = [];
  let byteLength = 0;
  function accessor(values: number[], type: string, width: number, componentType = 5126,
    bounds?: { min: number[]; max: number[] }): number {
    const size = componentType === 5123 ? 2 : 4;
    const buffer = Buffer.alloc(values.length * size);
    values.forEach((v, i) => componentType === 5123 ? buffer.writeUInt16LE(v, i * size) : buffer.writeFloatLE(v, i * size));
    const view = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: buffer.length });
    const padding = Buffer.alloc((4 - buffer.length % 4) % 4);
    chunks.push(buffer, padding);
    byteLength += buffer.length + padding.length;
    accessors.push({ bufferView: view, componentType, count: values.length / width, type, ...bounds });
    return accessors.length - 1;
  }
  const position = accessor([-.3, 0, 0, .3, 0, 0, .3, 1.5, 0, -.3, 1.5, 0], 'VEC3', 3, 5126,
    { min: [-.3, 0, 0], max: [.3, 1.5, 0] });
  const normal = accessor([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 'VEC3', 3);
  const joints = accessor([0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 'VEC4', 4, 5123);
  const weights = accessor([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 'VEC4', 4);
  const indices = accessor([0, 1, 2, 0, 2, 3], 'SCALAR', 1, 5123);
  const inverseBind = accessor([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -1, 0, 1,
  ], 'MAT4', 16);
  const walkTimes = accessor([0, .5, 1], 'SCALAR', 1, 5126, { min: [0], max: [1] });
  const runTimes = accessor([0, .3, .6], 'SCALAR', 1, 5126, { min: [0], max: [.6] });
  const walkTranslations = accessor([0, 0, 0, 0, .05, 0, 0, 0, 0], 'VEC3', 3);
  const runTranslations = accessor([0, 0, 0, 0, .12, 0, 0, 0, 0], 'VEC3', 3);
  const document = {
    asset: { version: '2.0', generator: 'Veylun synthetic inspection test fixture — not Meshy' },
    scene: 0,
    scenes: [{ name: 'SyntheticInspectionFixture', nodes: [0] }],
    nodes: [
      { name: 'SyntheticAssetRoot', children: [1, 2] },
      { name: 'SyntheticSkinnedPanel', mesh: 0, skin: 0 },
      { name: 'SyntheticHips', children: [3] },
      { name: 'SyntheticHand', translation: [0, 1, 0] },
    ],
    skins: [{ name: 'SyntheticSkeleton', inverseBindMatrices: inverseBind, skeleton: 2, joints: [2, 3] }],
    meshes: [{ name: 'SyntheticPanelGeometry', primitives: [{
      attributes: { POSITION: position, NORMAL: normal, JOINTS_0: joints, WEIGHTS_0: weights },
      indices, material: 0,
    }] }],
    materials: [{ name: 'SyntheticCoralMaterial', doubleSided: true,
      pbrMetallicRoughness: { baseColorFactor: [0.85, 0.2, 0.16, 1], metallicFactor: 0, roughnessFactor: .8 },
      extensions: { KHR_materials_ior: { ior: 1.45 } },
    }],
    extensionsUsed: ['KHR_materials_ior'],
    animations: [
      { name: 'Walking', samplers: [{ input: walkTimes, output: walkTranslations, interpolation: 'LINEAR' }],
        channels: [{ sampler: 0, target: { node: 2, path: 'translation' } }] },
      { name: 'Running', samplers: [{ input: runTimes, output: runTranslations, interpolation: 'LINEAR' }],
        channels: [{ sampler: 0, target: { node: 2, path: 'translation' } }] },
    ],
    buffers: [{ byteLength }], bufferViews, accessors,
  };
  const json = Buffer.from(JSON.stringify(document));
  const jsonPadded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
  const binary = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonPadded.length + 8 + binary.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonPadded.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binary.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, jsonPadded, binHeader, binary]);
}
