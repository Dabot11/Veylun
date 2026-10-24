import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { InspectionModel } from './inspectModel';

// Twenty actual sole vertices spanning boot edges and the flexing toe surface.
// Master SHA-256 d662ef7c34a346379d15f6eb31069a60f35b2dd161911ed5d6df98232ad5db35.
// Points are in inverse-bind joint space and retain the original skin weights.
// Boot heels are influenced by Leg as well as Foot: joint-center heights alone
// cannot detect their contact during a blended bent-knee stopping pose.
const probes: readonly (readonly { joint: string; weight: number; point: readonly [number, number, number] }[])[] = [
  // Left vertex 61534
  [
    { joint: 'mixamorig:LeftFoot', weight: 0.581998586655, point: [-0.0510357916355, 0.211564734578, -0.0409428291023] },
    { joint: 'mixamorig:LeftToeBase', weight: 0.418001413345, point: [0.0935274511576, 0.00781525671482, -0.0205080080777] },
  ],
  // Left vertex 61568
  [
    { joint: 'mixamorig:LeftFoot', weight: 0.50713968277, point: [-0.028456568718, 0.221468284726, -0.0424005649984] },
    { joint: 'mixamorig:LeftToeBase', weight: 0.492860287428, point: [0.0865847244859, 0.0312710702419, -0.0239212028682] },
  ],
  // Left vertex 61767
  [
    { joint: 'mixamorig:LeftToeBase', weight: 0.775620043278, point: [-0.00458716228604, 0.0835967808962, -0.0484167337418] },
    { joint: 'mixamorig:LeftFoot', weight: 0.224379971623, point: [0.0652533173561, 0.211860254407, 0.0102916173637] },
  ],
  // Left vertex 64504
  [
    { joint: 'mixamorig:LeftFoot', weight: 0.573035359383, point: [-0.1138875857, 0.0310694165528, 0.133851438761] },
    { joint: 'mixamorig:LeftLeg', weight: 0.423993110657, point: [-0.0984076932073, 0.488685488701, 0.070316337049] },
    { joint: 'mixamorig:LeftToeBase', weight: 0.00297155464068, point: [-0.0715255588293, -0.191068828106, -0.0373768694699] },
  ],
  // Left vertex 64850
  [
    { joint: 'mixamorig:LeftFoot', weight: 0.559379994869, point: [-0.0695980340242, 0.0208237990737, 0.163177996874] },
    { joint: 'mixamorig:LeftLeg', weight: 0.438466370106, point: [-0.0534683316946, 0.495746940374, 0.09959384799] },
    { joint: 'mixamorig:LeftToeBase', weight: 0.00215370533988, point: [-0.120378687978, -0.170659765601, -0.0484865680337] },
  ],
  // Left vertex 65065
  [
    { joint: 'mixamorig:LeftFoot', weight: 0.587267398834, point: [-0.0161665230989, 0.0451130755246, 0.160006210208] },
    { joint: 'mixamorig:LeftLeg', weight: 0.408594071865, point: [0.00205388665199, 0.503087460995, 0.0817512795329] },
    { joint: 'mixamorig:LeftToeBase', weight: 0.00413851859048, point: [-0.136483967304, -0.114826999605, -0.0573341362178] },
  ],
  // Right vertex 67297
  [
    { joint: 'mixamorig:RightToeBase', weight: 0.842129766941, point: [0.00691710785031, 0.0952502787113, -0.0467736124992] },
    { joint: 'mixamorig:RightFoot', weight: 0.15787024796, point: [-0.0727410614491, 0.213920176029, 0.00821749120951] },
  ],
  // Right vertex 67518
  [
    { joint: 'mixamorig:RightToeBase', weight: 0.584689676762, point: [-0.0791562199593, 0.0438701212406, -0.0339743122458] },
    { joint: 'mixamorig:RightFoot', weight: 0.415310293436, point: [0.0149718225002, 0.222969025373, -0.0411477684975] },
  ],
  // Right vertex 67598
  [
    { joint: 'mixamorig:RightFoot', weight: 0.562157332897, point: [0.0491857230663, 0.206931710243, -0.0358603894711] },
    { joint: 'mixamorig:RightToeBase', weight: 0.4378426373, point: [-0.0867778807878, 0.00651629269123, -0.0324430167675] },
  ],
  // Right vertex 70329
  [
    { joint: 'mixamorig:RightFoot', weight: 0.587543547153, point: [0.0194666981697, 0.0387251898646, 0.166503369808] },
    { joint: 'mixamorig:RightLeg', weight: 0.404599845409, point: [0.00246039032936, 0.500090420246, 0.0922332555056] },
    { joint: 'mixamorig:RightToeBase', weight: 0.00785669218749, point: [0.147427797318, -0.115673102438, -0.0510228648782] },
  ],
  // Right vertex 70421
  [
    { joint: 'mixamorig:RightFoot', weight: 0.573029816151, point: [0.045317530632, 0.0271894969046, 0.168659687042] },
    { joint: 'mixamorig:RightLeg', weight: 0.421026885509, point: [0.0292468219995, 0.496882200241, 0.10107537359] },
    { joint: 'mixamorig:RightToeBase', weight: 0.00594336539507, point: [0.140175893903, -0.14304587245, -0.0489907488227] },
  ],
  // Right vertex 70691
  [
    { joint: 'mixamorig:RightFoot', weight: 0.573777318001, point: [0.101449653506, 0.0304294638336, 0.141960293055] },
    { joint: 'mixamorig:RightLeg', weight: 0.420503288507, point: [0.0864410698414, 0.48830229044, 0.0780672803521] },
    { joint: 'mixamorig:RightToeBase', weight: 0.00571939721704, point: [0.0895778164268, -0.178696274757, -0.0424293652177] },
  ],
  // Contact during stopping blend, vertex 61784
  [
    { joint: 'mixamorig:LeftToeBase', weight: 0.606162846088, point: [-0.0281758643687, 0.0566798150539, -0.0529351532459] },
    { joint: 'mixamorig:LeftFoot', weight: 0.393837183714, point: [0.0572864711285, 0.188199803233, 0.0363315269351] },
  ],
  // Contact during stopping blend, vertex 62373
  [
    { joint: 'mixamorig:LeftFoot', weight: 0.611482083797, point: [0.0465703606606, 0.165612235665, 0.0563232637942] },
    { joint: 'mixamorig:LeftToeBase', weight: 0.388517946005, point: [-0.0460628196597, 0.0301500409842, -0.0538996532559] },
  ],
  // Contact during stopping blend, vertex 62388
  [
    { joint: 'mixamorig:LeftFoot', weight: 0.589378833771, point: [0.0476467162371, 0.166974872351, 0.0533649027348] },
    { joint: 'mixamorig:LeftToeBase', weight: 0.410621166229, point: [-0.0442347601056, 0.03269071877, -0.0524959340692] },
  ],
  // Contact during stopping blend, vertex 62395
  [
    { joint: 'mixamorig:LeftFoot', weight: 0.560526072979, point: [0.0479507446289, 0.17124773562, 0.0515320710838] },
    { joint: 'mixamorig:LeftToeBase', weight: 0.439473927021, point: [-0.0409461632371, 0.0356672257185, -0.053922355175] },
  ],
  // Contact during stopping blend, vertex 67341
  [
    { joint: 'mixamorig:RightToeBase', weight: 0.654178082943, point: [0.0331464111805, 0.0661680698395, -0.0509113930166] },
    { joint: 'mixamorig:RightFoot', weight: 0.345821917057, point: [-0.0632648617029, 0.188740998507, 0.0369765534997] },
  ],
  // Contact during stopping blend, vertex 67721
  [
    { joint: 'mixamorig:RightToeBase', weight: 0.503436326981, point: [0.0480917431414, 0.0472204685211, -0.0507219806314] },
    { joint: 'mixamorig:RightFoot', weight: 0.496563673019, point: [-0.0563875734806, 0.17142033577, 0.0523098036647] },
  ],
  // Contact during stopping blend, vertex 67739
  [
    { joint: 'mixamorig:RightFoot', weight: 0.528050482273, point: [-0.0553775280714, 0.167645186186, 0.055114403367] },
    { joint: 'mixamorig:RightToeBase', weight: 0.471949517727, point: [0.0512743964791, 0.0436486452818, -0.0502214506269] },
  ],
  // Contact during stopping blend, vertex 67759
  [
    { joint: 'mixamorig:RightFoot', weight: 0.547615289688, point: [-0.0499914884567, 0.168616861105, 0.0541299283504] },
    { joint: 'mixamorig:RightToeBase', weight: 0.452384740114, point: [0.0471089072526, 0.0400836914778, -0.0511502623558] },
  ],
];

/** Small surface sampler for the known master; no pose writes or mesh edits. */
export function createRuenSoleSampler(model: InspectionModel): (() => number) | undefined {
  if (model.container.skeletons.length !== 1 || model.container.skeletons[0]?.name !== 'SmartRigArmature' || model.container.skeletons[0]?.bones.length !== 80) return undefined;
  const nodes = new Map(model.container.transformNodes.map(node => [node.name, node]));
  if (probes.some(parts => parts.some(part => !nodes.has(part.joint)))) return undefined;
  const linked = probes.map(parts => parts.map(part => ({ node: nodes.get(part.joint)!, weight: part.weight, point: Vector3.FromArray(part.point) })));
  return () => Math.min(...linked.map(parts => parts.reduce((height, part) =>
    height + Vector3.TransformCoordinates(part.point, part.node.computeWorldMatrix(true)).y * part.weight, 0)));
}
