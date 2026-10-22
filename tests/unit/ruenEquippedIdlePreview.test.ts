import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { AssetContainer } from '@babylonjs/core/assetContainer';
import { Bone } from '@babylonjs/core/Bones/bone';
import { Skeleton } from '@babylonjs/core/Bones/skeleton';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Animation } from '@babylonjs/core/Animations/animation';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { instantiateInspectionModel } from '../../src/assets/inspectModel';
import { createRuenIdlePreview } from '../../src/assets/ruenIdlePreview';
import { createRuenEquippedIdlePreview, ruenEquippedIdleProfile } from '../../src/assets/ruenEquippedIdlePreview';

interface RigJson {
  nodes: { name: string; children?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }[];
  skins: { name: string; joints: number[] }[];
}

// Rest transforms copied from the unchanged master (SHA-256 d662ef7c…32ad5db35).
// This skeletal fixture exercises its nonuniform finger frames without loading
// mesh/textures or requiring Node-specific filesystem types in the test build.
const rigJson: RigJson = {
  nodes: [
    {"name":"mixamorig:HeadTop_End","rotation":[-2.891719039068124e-05,-0.001826056483117703,-3.954854217022845e-07,0.9999983323392896],"translation":[0.0,0.29926037788391113,1.1920928955078125e-07]},
    {"name":"headfront","rotation":[-7.714741343527225e-07,2.482942207392767e-08,-1.1095273144686802e-08,0.999999999999702],"translation":[-0.00038697756826877594,0.03456079959869385,0.10596245527267456]},
    {"children":[0,1],"name":"mixamorig:Head","rotation":[-0.02408001543901308,0.0024330428305940678,0.0016778898176156337,0.999705665606033],"translation":[-6.984919309616089e-10,0.07762360572814941,-5.960464477539063e-08]},
    {"children":[2],"name":"mixamorig:Neck","rotation":[0.16661359144178584,2.962311304694633e-07,3.964889056530471e-08,0.9860222670643805],"translation":[4.656612873077393e-10,0.06719362735748291,1.1175870895385742e-08]},
    {"name":"mixamorig:LeftHandThumb4","rotation":[-5.0505974567614135e-05,0.24477527121976103,-5.517581297409159e-05,0.9695798373543402],"translation":[0.0,0.027659595012664795,-2.9802322387695312e-08]},
    {"children":[4],"name":"mixamorig:LeftHandThumb3","rotation":[0.060635397018609934,-0.06253992601107354,-0.02808913592660316,0.995802744887672],"translation":[-2.9802322387695312e-08,0.026612460613250732,-2.9802322387695312e-08]},
    {"children":[5],"name":"mixamorig:LeftHandThumb2","rotation":[0.26567633296813387,-0.08287209500104997,-0.07776691713993174,0.9573403828154818],"translation":[2.9802322387695312e-08,0.02765941619873047,-1.1920928955078125e-07]},
    {"children":[6],"name":"mixamorig:LeftHandThumb1","rotation":[0.3192752771344821,0.9132502279231489,0.16967627076553868,0.1877425943895414],"translation":[0.01876729726791382,0.02252984046936035,0.020944654941558838]},
    {"name":"mixamorig:LeftHandPinky4","rotation":[0.00014565164226144938,-0.012160014885362343,-1.7715514723024124e-06,0.9999260536761949],"translation":[1.4901161193847656e-08,0.01669442653656006,-2.9802322387695312e-08]},
    {"children":[8],"name":"mixamorig:LeftHandPinky3","rotation":[-0.10563960652440661,-3.356225968218582e-06,-1.1186825755631751e-07,0.9944044818493588],"translation":[-1.4901161193847656e-08,0.016507387161254883,5.960464477539063e-08]},
    {"children":[9],"name":"mixamorig:LeftHandPinky2","rotation":[-0.046633712731497204,0.705569011258581,0.04663351684746672,0.7055657179135773],"translation":[0.0,0.016716301441192627,-7.450580596923828e-09]},
    {"children":[10],"name":"mixamorig:LeftHandPinky1","rotation":[-0.179399887618659,-0.9450047440523991,0.18223779990594785,0.20388991717667634],"translation":[-0.017721742391586304,0.10020220279693604,-0.031342923641204834]},
    {"name":"mixamorig:LeftHandRing4","rotation":[-4.3399861202537285e-05,-0.015242000849493897,7.8773852028586e-05,0.9998838299128736],"translation":[2.9802322387695312e-08,0.020334482192993164,0.0]},
    {"children":[12],"name":"mixamorig:LeftHandRing3","rotation":[-0.09407106129166297,0.6150983386127236,0.13655396253514757,0.7708162456638268],"translation":[0.0,0.019775450229644775,0.0]},
    {"children":[13],"name":"mixamorig:LeftHandRing2","rotation":[0.04406736669571571,0.47123734146990554,0.06985290309291424,0.8781309737882914],"translation":[0.0,0.020334601402282715,-5.960464477539063e-08]},
    {"children":[14],"name":"mixamorig:LeftHandRing1","rotation":[-0.0536350875862122,0.8336352135802423,-0.17442090500613694,0.5212992959476191],"translation":[-0.00874212384223938,0.10560643672943115,-0.014400601387023926]},
    {"name":"mixamorig:LeftHandIndex4","rotation":[-4.155292386945449e-05,-0.01652172545635486,6.86676467020913e-07,0.9998635061151236],"translation":[-1.4901161193847656e-08,0.02278691530227661,-1.4901161193847656e-08]},
    {"children":[16],"name":"mixamorig:LeftHandIndex3","rotation":[-0.048827543094981836,0.19784825258420755,0.03911774073464811,0.9782339916116697],"translation":[0.0,0.022192955017089844,0.0]},
    {"children":[17],"name":"mixamorig:LeftHandIndex2","rotation":[0.05447940056975452,0.8034416408566678,0.1987864540312068,0.5585673373415282],"translation":[-1.4901161193847656e-08,0.02278691530227661,5.960464477539063e-08]},
    {"children":[18],"name":"mixamorig:LeftHandIndex1","rotation":[0.06532909187595395,0.9774961469435023,-0.07276747342514882,0.18691786237968408],"translation":[0.007458895444869995,0.11064296960830688,0.02225703001022339]},
    {"name":"mixamorig:LeftHandMiddle4","rotation":[9.968143697304923e-05,-0.016203581524498963,1.385097434158634e-05,0.9998687082900137],"translation":[-1.4901161193847656e-08,0.02241063117980957,0.0]},
    {"children":[20],"name":"mixamorig:LeftHandMiddle3","rotation":[-0.055483551480656854,0.7473188317281328,0.1443928187174862,0.6462096046658632],"translation":[-5.960464477539063e-08,0.021981537342071533,0.0]},
    {"children":[21],"name":"mixamorig:LeftHandMiddle2","rotation":[0.07612053651527738,0.43862301957882893,0.08453621308539319,0.8914421682270576],"translation":[0.0,0.02262955904006958,0.0]},
    {"children":[22],"name":"mixamorig:LeftHandMiddle1","rotation":[0.07130217117963535,0.9746615113859967,-0.10409662673245995,0.1847020057031263],"translation":[0.00023749470710754395,0.11101073026657104,0.002541661262512207]},
    {"children":[7,11,15,19,23],"name":"mixamorig:LeftHand","rotation":[0.008987561996112696,0.02929585258990958,-0.00431576204528344,0.9995210607827956],"translation":[8.940696716308594e-08,0.21547985076904297,0.0]},
    {"children":[24],"name":"mixamorig:LeftForeArm","rotation":[0.05832819250444313,-0.01297726805830842,-0.08814853116920532,0.9943134560718864],"translation":[0.0,0.2029849886894226,-5.960464477539063e-08]},
    {"children":[25],"name":"mixamorig:LeftArm","rotation":[-0.36375185166307744,0.5308207971442366,-0.024863112653414562,0.765046206029429],"translation":[8.940696716308594e-08,0.12738728523254395,1.1920928955078125e-07]},
    {"children":[26],"name":"mixamorig:LeftShoulder","rotation":[-0.5994039514409456,-0.547505321611052,-0.5322070008735434,0.2402260061395253],"translation":[0.023269036784768105,0.03630948066711426,0.00477183610200882]},
    {"name":"mixamorig:RightHandThumb4","rotation":[-1.5548148733135773e-05,-0.24687710179500394,-6.36345379594118e-05,0.9690467957318677],"translation":[1.4901161193847656e-08,0.027309417724609375,-5.960464477539063e-08]},
    {"children":[28],"name":"mixamorig:RightHandThumb3","rotation":[0.06556355447593885,0.06614178697775586,0.03011293355709599,0.9951984202019494],"translation":[-7.450580596923828e-08,0.026216208934783936,0.0]},
    {"children":[29],"name":"mixamorig:RightHandThumb2","rotation":[0.2610071824303367,0.07959230555841904,0.07544961239789867,0.9590868947101087],"translation":[1.4901161193847656e-08,0.0273093581199646,-1.1920928955078125e-07]},
    {"children":[30],"name":"mixamorig:RightHandThumb1","rotation":[0.30290287211609374,-0.921104354474857,-0.14991131916739578,0.1932439251742985],"translation":[-0.020484477281570435,0.027631640434265137,0.024165809154510498]},
    {"name":"mixamorig:RightHandPinky4","rotation":[5.293422577008788e-05,0.021355827297328666,1.706832876727927e-05,0.9997719367671243],"translation":[-1.4901161193847656e-08,0.01882559061050415,1.30385160446167e-08]},
    {"children":[32],"name":"mixamorig:RightHandPinky3","rotation":[-0.07807525657645925,0.2178402185629256,0.06152536073001699,0.9709091221499664],"translation":[0.0,0.01881355047225952,7.450580596923828e-08]},
    {"children":[33],"name":"mixamorig:RightHandPinky2","rotation":[-0.06887319698752814,-0.7037448167494635,-0.0688732058557065,0.7037444118073967],"translation":[2.9802322387695312e-08,0.019048452377319336,-7.450580596923828e-09]},
    {"children":[34],"name":"mixamorig:RightHandPinky1","rotation":[-0.172101016542646,0.9425419019389512,-0.2076360456683159,0.19718842697662936],"translation":[0.017962276935577393,0.10172379016876221,-0.031786203384399414]},
    {"name":"mixamorig:RightHandIndex4","rotation":[-2.0778666840388076e-06,0.025201271223547383,-5.223373233981102e-08,0.999682397526533],"translation":[0.0,0.02070009708404541,2.9802322387695312e-08]},
    {"children":[36],"name":"mixamorig:RightHandIndex3","rotation":[-0.07008743753881853,-0.41807979590416877,-0.0811657963032161,0.902058284628236],"translation":[-5.960464477539063e-08,0.020021498203277588,3.725290298461914e-09]},
    {"children":[37],"name":"mixamorig:RightHandIndex2","rotation":[0.08328767534698345,-0.6557155044709435,-0.15149706924449702,0.7349482827669167],"translation":[0.0,0.020713329315185547,0.0]},
    {"children":[38],"name":"mixamorig:RightHandIndex1","rotation":[0.0482009258541824,-0.9761873489629166,0.09397000218781303,0.1894850103843969],"translation":[-0.0069144368171691895,0.11538568139076233,0.021228253841400146]},
    {"name":"mixamorig:RightHandRing4","rotation":[0.00012826777791477006,0.017669928696874473,3.085966679850577e-05,0.9998438659185271],"translation":[0.0,0.022844970226287842,5.4016709327697754e-08]},
    {"children":[40],"name":"mixamorig:RightHandRing3","rotation":[-0.11600545195117878,-0.39519447097193655,-0.10806091013251687,0.9048131878637413],"translation":[5.960464477539063e-08,0.022576451301574707,-5.960464477539063e-08]},
    {"children":[41],"name":"mixamorig:RightHandRing2","rotation":[0.017249496026796613,-0.7930561042683324,-0.1348590303258803,0.593782377903825],"translation":[-2.2351741790771484e-08,0.023290157318115234,-5.960464477539063e-08]},
    {"children":[42],"name":"mixamorig:RightHandRing1","rotation":[-0.07693815813330614,-0.8284478031946624,0.18779546129335214,0.5220034692630018],"translation":[0.009133130311965942,0.10816925764083862,-0.01513141393661499]},
    {"name":"mixamorig:RightHandMiddle4","rotation":[6.290297168191538e-05,0.025758829385098256,1.6210010846522835e-06,0.9996681843238275],"translation":[0.0,0.02228492498397827,2.9802322387695312e-08]},
    {"children":[44],"name":"mixamorig:RightHandMiddle3","rotation":[-0.055239375272874196,-0.6808322482201393,-0.1277205426992094,0.719099105948264],"translation":[0.0,0.02166217565536499,-2.9802322387695312e-08]},
    {"children":[45],"name":"mixamorig:RightHandMiddle2","rotation":[0.07636136785144064,-0.39393808364231137,-0.07667859308170508,0.9127442802445221],"translation":[2.9802322387695312e-08,0.022296249866485596,5.960464477539063e-08]},
    {"children":[46],"name":"mixamorig:RightHandMiddle1","rotation":[0.0542471779803187,-0.9726647677137279,0.12525143725578333,0.1878631704058356],"translation":[0.0003040134906768799,0.11461490392684937,0.0015234947204589844]},
    {"children":[31,35,39,43,47],"name":"mixamorig:RightHand","rotation":[0.04613268652187638,-0.02590754172293367,0.028176915485239856,0.9982017010353601],"translation":[0.0,0.22436124086380005,0.0]},
    {"children":[48],"name":"mixamorig:RightForeArm","rotation":[0.04551757527949018,0.009265655922817018,0.07737288120789872,0.9959195425407539],"translation":[-5.960464477539063e-08,0.19069325923919678,-2.9802322387695312e-08]},
    {"children":[49],"name":"mixamorig:RightArm","rotation":[-0.35946585476164844,-0.536515030369505,0.024472722298742196,0.7631100885923179],"translation":[0.0,0.12641111016273499,1.1920928955078125e-07]},
    {"children":[50],"name":"mixamorig:RightShoulder","rotation":[-0.6052165253040293,0.5447813877795579,0.5295606819863548,0.23767978694462674],"translation":[-0.0242732185870409,0.03709113597869873,0.005754049867391586]},
    {"name":"Bone_028","rotation":[8.439440273176584e-08,-6.891914239304172e-08,3.3159817415048035e-08,0.9999999999999936],"translation":[2.9802322387695312e-08,0.10071021318435669,0.0]},
    {"children":[52],"name":"Bone_029","rotation":[-0.023457858072969993,-0.07277458014984367,0.4055436590580805,0.9108720711364608],"translation":[5.960464477539063e-08,0.18234539031982422,1.4901161193847656e-08]},
    {"children":[53],"name":"Bone_030","rotation":[-0.01810185531160763,1.517922635598892e-06,-1.1346298141625804e-05,0.9998361479278668],"translation":[-5.960464477539063e-08,0.18149709701538086,-1.4901161193847656e-08]},
    {"children":[54],"name":"Bone_031","rotation":[0.012147221589317374,-0.0015865249379318417,0.01235073007473976,0.9998486822579217],"translation":[5.960464477539063e-08,0.14878547191619873,0.0]},
    {"children":[55],"name":"Bone_032","rotation":[-0.005892395791096531,-0.05265355304835266,0.9963109974474709,0.06750762466900523],"translation":[-0.15273438394069672,0.050817131996154785,-0.038852568715810776]},
    {"name":"Bone_033","rotation":[1.2983178976354792e-07,1.860835929789914e-08,3.1628773911047124e-07,0.9999999999999414],"translation":[8.940696716308594e-08,0.11916148662567139,-2.9802322387695312e-08]},
    {"children":[57],"name":"Bone_034","rotation":[-0.00948347379906435,0.06950772464776546,-0.42630796334644167,0.9018537909918669],"translation":[5.960464477539063e-08,0.18318992853164673,0.0]},
    {"children":[58],"name":"Bone_035","rotation":[-0.017746016711651658,-0.002424827239215796,0.018074455384268256,0.9996762041612733],"translation":[-2.9802322387695312e-08,0.18149679899215698,2.9802322387695312e-08]},
    {"children":[59],"name":"Bone_036","rotation":[0.01250081746313285,-0.001277238344902588,0.009916227902800208,0.9998718751165789],"translation":[-2.9802322387695312e-08,0.14804291725158691,-1.4901161193847656e-08]},
    {"children":[60],"name":"Bone_037","rotation":[-0.003970189647523331,0.05307252968407535,-0.9975603274191083,0.04517673457187122],"translation":[0.15937498211860657,0.05081737041473389,-0.03885257616639137]},
    {"name":"Bone_038","rotation":[3.9968028886505635e-15,-1.0013985873723086e-15,-4.352972990251386e-16,1.0],"translation":[2.3283064365386963e-10,0.10952001810073853,2.9802322387695312e-08]},
    {"children":[62],"name":"Bone_039","rotation":[-0.06711020596043192,1.4995585898301407e-07,-1.6312515639939018e-09,0.9977455688981665],"translation":[2.3283064365386963e-10,0.24053382873535156,-2.9802322387695312e-08]},
    {"children":[63],"name":"Bone_040","rotation":[-0.020898809641214648,-1.512531941262454e-07,-5.890249949864896e-10,0.9997815960276312],"translation":[-2.3283064365386963e-10,0.19303584098815918,0.0]},
    {"children":[64],"name":"Bone_041","rotation":[-6.018658336350352e-08,-0.020102098880732458,0.9997979323946343,3.495173521809118e-09],"translation":[-4.6566128730773926e-09,-0.01689314842224121,-0.08341564238071442]},
    {"children":[3,27,51,56,61,65],"name":"mixamorig:Spine2","rotation":[0.3244326052614577,7.629856676601772e-06,-2.6334824862147843e-06,0.9459088140926234],"translation":[0.0,0.13469696044921875,5.960464477539063e-08]},
    {"children":[66],"name":"mixamorig:Spine1","rotation":[-0.24642541328644216,-7.85295625433787e-06,1.9869205132771e-06,0.9691617592646696],"translation":[0.0,0.10965216159820557,-4.470348358154297e-08]},
    {"children":[67],"name":"mixamorig:Spine","rotation":[-0.338161596308271,-0.02277152356680542,-0.026052399170538337,0.9404517345372634],"translation":[7.450580596923828e-09,0.12810319662094116,5.960464477539063e-08]},
    {"name":"mixamorig:LeftToe_End","rotation":[-0.03321708724067916,0.09623417500529678,-0.8872058838572284,0.45000147591470085],"translation":[4.0978193283081055e-08,0.06313331425189972,-2.7939677238464355e-09]},
    {"children":[69],"name":"mixamorig:LeftToeBase","rotation":[0.40596360709896795,0.841458387523408,-0.2972056832371235,0.1970028264499158],"translation":[4.470348358154297e-08,0.14122220873832703,-7.450580596923828e-09]},
    {"children":[70],"name":"mixamorig:LeftFoot","rotation":[-0.379457483037884,0.014047955570370299,-0.07030472176194345,0.9224271893265196],"translation":[-5.960464477539063e-08,0.3574473261833191,-6.51925802230835e-09]},
    {"children":[71],"name":"mixamorig:LeftLeg","rotation":[-0.023441356620856398,-0.009663291465078558,0.006640393174846149,0.9996564553767051],"translation":[0.0,0.35734739899635315,0.0]},
    {"children":[72],"name":"mixamorig:LeftUpLeg","rotation":[0.9661575079826386,0.07496161879718799,0.07993732647450001,0.2335175567536456],"translation":[0.06645727902650833,-0.049658238887786865,0.10404306650161743]},
    {"name":"mixamorig:RightToe_End","rotation":[-0.0778738260451258,-0.1622131423002371,0.8806225301430038,0.4383223962869236],"translation":[-3.725290298461914e-09,0.07147298753261566,5.587935447692871e-09]},
    {"children":[74],"name":"mixamorig:RightToeBase","rotation":[0.39653214101786843,-0.8311895568163254,0.30055483779905084,0.24809871272308534],"translation":[-1.4901161193847656e-08,0.1367875039577484,7.450580596923828e-09]},
    {"children":[75],"name":"mixamorig:RightFoot","rotation":[-0.3747772181936244,-0.012454911682453227,0.0679572682646374,0.9245370309446987],"translation":[1.4901161193847656e-08,0.354870080947876,-1.862645149230957e-09]},
    {"children":[76],"name":"mixamorig:RightLeg","rotation":[-0.02352314639762971,0.009594215275276232,-0.0065552700749545575,0.9996557612753761],"translation":[-1.4901161193847656e-08,0.3604286015033722,7.450580596923828e-09]},
    {"children":[77],"name":"mixamorig:RightUpLeg","rotation":[0.9661767626976944,-0.1212726133682175,-0.02913722360497997,0.2257131778838786],"translation":[-0.09015101194381714,-0.04384809732437134,0.09427326917648315]},
    {"children":[68,73,78],"name":"mixamorig:Hips","rotation":[0.2743466221696569,0.024467025053023547,0.02446703044834785,0.9610081477335111],"translation":[0.007624725345522165,0.9402564167976379,0.0008559757843613625]},
    {"name":"output_unwrapped"},
    {"children":[80,79],"name":"target_character"},
  ],
  skins: [{"name":"SmartRigArmature","joints":[79,68,67,66,3,2,0,1,27,26,25,24,7,6,5,4,11,10,9,8,15,14,13,12,19,18,17,16,23,22,21,20,51,50,49,48,31,30,29,28,35,34,33,32,39,38,37,36,43,42,41,40,47,46,45,44,56,55,54,53,52,61,60,59,58,57,65,64,63,62,73,72,71,70,69,78,77,76,75,74]}],
};
const engines: NullEngine[] = [];

function fixture() {
  const engine = new NullEngine(); engines.push(engine);
  const scene = new Scene(engine), container = new AssetContainer(scene);
  const conversion = new TransformNode('gltf-conversion', scene);
  conversion.rotationQuaternion = new Quaternion(0, 1, 0, 0); conversion.scaling.z = -1;
  const nodes = rigJson.nodes.map(source => {
    const node = new TransformNode(source.name, scene);
    node.position.copyFrom(Vector3.FromArray(source.translation ?? [0, 0, 0]));
    node.rotationQuaternion = Quaternion.FromArray(source.rotation ?? [0, 0, 0, 1]);
    node.scaling.copyFrom(Vector3.FromArray(source.scale ?? [1, 1, 1]));
    return node;
  });
  const parents = new Map<number, number>();
  rigJson.nodes.forEach((source, index) => {
    for (const child of source.children ?? []) { nodes[child]!.parent = nodes[index]!; parents.set(child, index); }
  });
  for (const node of nodes) if (!node.parent) node.parent = conversion;
  container.transformNodes.push(conversion, ...nodes);
  const skin = rigJson.skins[0]!, jointIndices = new Set(skin.joints);
  const skeleton = new Skeleton(skin.name, skin.name, scene); container.skeletons.push(skeleton);
  const bones = new Map<number, Bone>();
  const addBone = (index: number): Bone => {
    const existing = bones.get(index); if (existing) return existing;
    let parent = parents.get(index);
    while (parent !== undefined && !jointIndices.has(parent)) parent = parents.get(parent);
    const bone = new Bone(nodes[index]!.name, skeleton, parent === undefined ? null : addBone(parent), Matrix.Identity());
    bone.linkTransformNode(nodes[index]!); bones.set(index, bone); return bone;
  };
  for (const index of skin.joints) addBone(index);
  const find = (name: string) => nodes.find(node => node.name === name)!;
  const walking = new AnimationGroup('Walking', scene);
  for (const name of ['mixamorig:LeftForeArm', 'mixamorig:RightHandIndex1']) {
    const node = find(name), source = new Animation(`source:${name}`, 'rotationQuaternion', 30, Animation.ANIMATIONTYPE_QUATERNION);
    source.setKeys([{ frame: 0, value: node.rotationQuaternion!.clone() },
      { frame: 30, value: node.rotationQuaternion!.multiply(Quaternion.RotationAxis(Vector3.Up(), 0.4)) }]);
    walking.addTargetedAnimation(source, node);
  }
  container.animationGroups.push(walking); container.removeAllFromScene();
  const model = instantiateInspectionModel(container, scene);
  const neutral = createRuenIdlePreview(model, scene); container.animationGroups.push(neutral);
  return { scene, container, skeleton, nodes, model, neutral, walking, find, conversion };
}

function pose(node: TransformNode) {
  return { position: node.position.asArray(), rotation: node.rotationQuaternion?.asArray(),
    euler: node.rotation.asArray(), scale: node.scaling.asArray(), parent: node.parent?.name };
}

function handPoint(find: (name: string) => TransformNode, side: string, finger: string) {
  const hand = find(`mixamorig:${side}Hand`), tip = find(`mixamorig:${side}Hand${finger}4`);
  return Vector3.TransformCoordinates(Vector3.Zero(), tip.computeWorldMatrix(true).multiply(Matrix.Invert(hand.computeWorldMatrix(true))));
}

afterEach(() => { for (const engine of engines.splice(0)) engine.dispose(); });

describe('equipped Idle preview pose', () => {
  it('creates an independent stopped group without changing imported poses, clips, inventory or bind matrices', () => {
    const { scene, model, neutral, nodes, walking, skeleton } = fixture();
    const before = nodes.map(pose), report = structuredClone(model.report), neutralData = neutral.serialize(), sourceData = walking.serialize();
    const bindings = skeleton.bones.map(bone => Array.from(bone.getBindMatrix().m));
    const armed = createRuenEquippedIdlePreview(model, scene, neutral);
    expect(armed.name).toBe('Ruen_Idle_Armed_v1'); expect(armed.from).toBe(0); expect(armed.to).toBe(120);
    expect(!!armed.isStarted).toBe(false); expect(!!armed.isPlaying).toBe(false);
    expect(nodes.map(pose)).toEqual(before); expect(model.report).toEqual(report);
    expect(model.container.animationGroups).toEqual([walking, neutral]);
    expect(neutral.serialize()).toEqual(neutralData); expect(walking.serialize()).toEqual(sourceData);
    expect(skeleton.bones.map(bone => Array.from(bone.getBindMatrix().m))).toEqual(bindings);
    expect(armed.targetedAnimations).toHaveLength(38);
    for (const track of armed.targetedAnimations) {
      expect(track.animation.targetProperty).toBe('rotationQuaternion');
      expect(track.target.name).toMatch(/^mixamorig:(Spine[12]|(Left|Right)(Arm|ForeArm|Hand.*))$/);
      expect(track.target.name).not.toMatch(/Hips|Leg|Foot|Toe|Shoulder/);
      if (!track.target.name.includes('Spine')) {
        expect(track.animation.getKeys()[0]!.value.asArray()).toEqual(track.animation.getKeys()[1]!.value.asArray());
      }
    }
    for (let index = 0; index < 2; index++) {
      const clone = armed.targetedAnimations[index]!.animation, source = neutral.targetedAnimations[index]!.animation;
      expect(clone).not.toBe(source); expect(clone.getKeys()[0]!.value).not.toBe(source.getKeys()[0]!.value);
      expect(clone.getKeys().map(key => key.value.asArray())).toEqual(source.getKeys().map(key => key.value.asArray()));
    }
  });

  it('raises only the left forearm, closes both grips, and leaves root, legs and right wrist in place', () => {
    const { scene, model, neutral, nodes, find } = fixture();
    const fixed = [model.root, ...nodes.filter(node => /Hips|UpLeg|Leg$|Foot|Toe/.test(node.name))];
    const fixedBefore = fixed.map(node => ({ local: pose(node), world: Array.from(node.computeWorldMatrix(true).m) }));
    const rightBefore = find('mixamorig:RightHand').getAbsolutePosition().clone();
    const elbowsBefore = ['Left', 'Right'].map(side => find(`mixamorig:${side}ForeArm`).getAbsolutePosition().clone());
    const tipsBefore = ['Left', 'Right'].flatMap(side => ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'].map(finger => ({
      side, finger, point: handPoint(find, side, finger),
    })));
    const armed = createRuenEquippedIdlePreview(model, scene, neutral);
    armed.start(true); armed.pause(); armed.goToFrame(0);
    const wrist = find('mixamorig:LeftHand'); wrist.computeWorldMatrix(true);
    expect(wrist.getAbsolutePosition().x).toBeCloseTo(-0.27, 2);
    expect(wrist.getAbsolutePosition().y).toBeCloseTo(1.10, 2);
    expect(wrist.getAbsolutePosition().z).toBeCloseTo(0.24, 2);
    expect(find('mixamorig:RightHand').computeWorldMatrix(true)).toBeDefined();
    expect(find('mixamorig:RightHand').getAbsolutePosition().equalsWithEpsilon(rightBefore, 1e-6)).toBe(true);
    for (const [index, side] of ['Left', 'Right'].entries()) {
      const elbow = find(`mixamorig:${side}ForeArm`); elbow.computeWorldMatrix(true);
      expect(elbow.getAbsolutePosition().equalsWithEpsilon(elbowsBefore[index]!, 1e-6)).toBe(true);
    }
    for (const { side, finger, point } of tipsBefore) {
      const gripCenter = new Vector3(0, 0.09, -0.005);
      expect(Vector3.Distance(handPoint(find, side, finger), gripCenter), `${side} ${finger} grip`).toBeLessThan(Vector3.Distance(point, gripCenter));
    }
    armed.goToFrame(60);
    fixed.forEach((node, index) => {
      expect(pose(node)).toEqual(fixedBefore[index]!.local);
      expect(Array.from(node.computeWorldMatrix(true).m)).toEqual(fixedBefore[index]!.world);
    });
  });

  it('restores every arm and grip channel when the shared player switches clips or stops', () => {
    const { scene, model, neutral, nodes, find, walking } = fixture();
    const touched = nodes.filter(node => /(?:Left|Right)(Arm|ForeArm|Hand.*[123]?)$/.test(node.name));
    const rest = touched.map(pose), source = walking.targetedAnimations.map(track => track.animation.serialize());
    const armed = createRuenEquippedIdlePreview(model, scene, neutral); model.container.animationGroups.push(armed);
    model.player.select(armed.name); model.player.pause(); armed.goToFrame(60);
    expect(touched.map(pose)).not.toEqual(rest);
    model.player.select(neutral.name); model.player.pause(); neutral.goToFrame(0);
    expect(touched.map(pose)).toEqual(rest);
    model.player.select(walking.name); model.player.pause(); walking.goToFrame(20);
    expect(find('mixamorig:LeftForeArm').rotationQuaternion!.asArray()).not.toEqual(rest[touched.indexOf(find('mixamorig:LeftForeArm'))]!.rotation);
    model.player.select(armed.name); model.player.pause(); armed.goToFrame(60);
    model.player.stopAll();
    expect(touched.map(pose)).toEqual(rest);
    expect(walking.targetedAnimations.map(track => track.animation.serialize())).toEqual(source);
    expect(model.container.animationGroups.every(group => !group.isStarted)).toBe(true);
    model.dispose(); expect(scene.animationGroups).toHaveLength(0);
  });

  it('aims beneath an arbitrarily transformed outer root while preserving the mirrored conversion node', () => {
    const { scene, model, neutral, find, conversion } = fixture();
    model.root.position.set(3, 0.5, -2); model.root.rotation.y = 0.7; model.root.scaling.setAll(0.85);
    const conversionBefore = pose(conversion), rootBefore = pose(model.root);
    const armed = createRuenEquippedIdlePreview(model, scene, neutral); armed.start(true); armed.pause(); armed.goToFrame(0);
    const wrist = find('mixamorig:LeftHand'); wrist.computeWorldMatrix(true);
    const local = Vector3.TransformCoordinates(wrist.getAbsolutePosition(), Matrix.Invert(model.root.computeWorldMatrix(true)));
    expect(local.x).toBeCloseTo(ruenEquippedIdleProfile.leftWristTarget[0], 2);
    expect(local.y).toBeCloseTo(ruenEquippedIdleProfile.leftWristTarget[1], 2);
    expect(local.z).toBeCloseTo(ruenEquippedIdleProfile.leftWristTarget[2], 2);
    expect(pose(model.root)).toEqual(rootBefore); expect(pose(conversion)).toEqual(conversionBefore);
  });

  it('rejects duplicate names, active captures and incompatible hand links without allocating a partial group', () => {
    for (const alteration of ['duplicate', 'active', 'unlinked-hand', 'wrong-parent', 'duplicate-node', 'wrong-neutral'] as const) {
      const { scene, model, neutral, skeleton, find } = fixture();
      if (alteration === 'duplicate') model.container.animationGroups.push(new AnimationGroup(ruenEquippedIdleProfile.name, scene));
      if (alteration === 'active') { neutral.start(true); neutral.pause(); }
      if (alteration === 'unlinked-hand') skeleton.bones.find(bone => bone.name === 'mixamorig:RightHand')!.linkTransformNode(null);
      if (alteration === 'wrong-parent') find('mixamorig:LeftHandIndex2').parent = find('mixamorig:LeftHand');
      if (alteration === 'duplicate-node') model.container.transformNodes.push(new TransformNode('mixamorig:RightHand', scene));
      if (alteration === 'wrong-neutral') neutral.name = 'another-clip';
      const before = [...scene.animationGroups], poses = model.container.transformNodes.map(pose);
      expect(() => createRuenEquippedIdlePreview(model, scene, neutral), alteration).toThrow();
      expect(scene.animationGroups).toEqual(before); expect(model.container.transformNodes.map(pose)).toEqual(poses);
    }
  });
});
