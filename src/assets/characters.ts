import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Geometry } from './geometry';
import type { Player, Enemy } from '../core/Simulation';
export interface CharacterRig { root:TransformNode; parts:Record<string,TransformNode>; update(state:Player|Enemy,time:number):void }
function mergeRigidParts(root:TransformNode,parts:Record<string,TransformNode>):void{
 const groups=new Map<TransformNode,Map<string,Mesh[]>>();
 for(const m of root.getChildMeshes())if(m instanceof Mesh&&m.parent instanceof TransformNode&&!Object.values(parts).includes(m)){const materials=groups.get(m.parent)??new Map<string,Mesh[]>();const key=(m.material?.name??'')+'|'+m.getVerticesDataKinds().sort().join(',');const meshes=materials.get(key)??[];meshes.push(m);materials.set(key,meshes);groups.set(m.parent,materials);}
 for(const[parent,materials]of groups)for(const meshes of materials.values())if(meshes.length>1){parent.computeWorldMatrix(true);const inverse=parent.getWorldMatrix().clone().invert();const merged=Mesh.MergeMeshes(meshes,true,true,undefined,false,true);if(merged){merged.bakeTransformIntoVertices(inverse);merged.parent=parent;merged.isPickable=false;}}
}
const wood='#775232',moss='#71833c',gold='#bd934d',teal='#41e3cf',stone='#8c9380';
export function createRuen(g:Geometry):CharacterRig{
 const root=g.node('ruen-provisional'),parts:Record<string,TransformNode>={};root.setPivotPoint(new Vector3(0,.65,0));
 const hips=g.node('hips',root,[0,.68,0]);parts['hips']=hips;
 g.sphere('tunic',hips,[0,.19,0],[.43,.46,.27],'#263f38',0,12);
 g.cylinder('belt',hips,[0,-.015,0],.09,.42,.42,wood);g.box('belt-buckle',hips,[0,0,.157],[.1,.07,.025],gold);
 g.tube('strap',hips,[[-.18,.4,.09],[0,.19,.15],[.16,.03,.13]],.028,wood);
 g.gem('chest-jewel',hips,[0,.24,.17],.075);
 for(const side of [-1,1]){
   const leg=g.node(`leg-${side}`,hips,[side*.115,-.06,0]);parts[`leg${side}`]=leg;
   g.sphere('trouser',leg,[0,-.17,0],[.18,.36,.20],'#303831');
   g.cylinder('boot-shaft',leg,[0,-.42,0],.26,.19,.18,'#69452c');g.box('boot-cuff',leg,[0,-.3,0],[.21,.085,.22],'#92623b');
   g.sphere('boot',leg,[0,-.55,.06],[.22,.15,.35],'#553b29',0,8);g.box('buckle',leg,[0,-.39,.11],[.09,.035,.025],gold);
   const arm=g.node(`arm-${side}`,hips,[side*.27,.3,0]);parts[`arm${side}`]=arm;
   g.sphere('sleeve',arm,[0,-.07,0],[.21,.2,.23],'#24443d');
   g.sphere('forearm',arm,[0,-.22,0],[.12,.24,.13],'#d8a47d');
   g.cylinder('bracer',arm,[0,-.31,0],.14,.14,.15,wood);g.sphere('glove',arm,[0,-.41,.015],[.13,.13,.13],'#3a3730');
   g.gem('bracer-gem',arm,[0,-.28,.09],.05);
   g.box('pouch',hips,[side*.24,-.07,0],[.13,.16,.12],wood);
 }
 const head=g.node('head',hips,[0,.53,0]);parts['head']=head;
 g.sphere('face',head,[0,0,0],[.37,.40,.32],'#e0ad83',0,16);
 g.sphere('nose',head,[0,-.025,.16],[.06,.075,.08],'#d89f74');
 for(const side of [-1,1]){
  g.sphere('ear',head,[side*.18,-.015,0],[.075,.11,.065],'#dba47b');
  g.sphere('eye-white',head,[side*.085,.01,.145],[.105,.09,.028],'#f7e8cb',0,10);
  g.sphere('iris',head,[side*.078,.01,.16],[.045,.064,.018],'#754629',0,10);
  g.sphere('pupil',head,[side*.078,.01,.17],[.025,.045,.015],'#161d17');
  g.sphere('eye-glint',head,[side*.07,.027,.18],[.013,.015,.009],'#fff7da',.4);
  const brow=g.box('brow',head,[side*.084,.072,.16],[.10,.022,.02],'#853c1a');brow.rotation.z=side*.13;
 }
 g.sphere('hair-base',head,[0,.12,-.045],[.43,.29,.35],'#a83d1d',0,12);
 for(let i=0;i<19;i++){
  const a=i*2.399,rad=.14;const x=Math.sin(a)*rad,z=Math.cos(a)*rad;
  const tip=[x+Math.sin(a+.7)*.08,.09+(i%4)*.025,z+.055] as const;
  g.tube('copper-lock',head,[[x*.35,.23,z*.4],[x,.22+(i%3)*.025,z],tip],.035,i%3===0?'#e57e31':'#c35120');
 }
 for(let i=0;i<5;i++)g.tube('fringe',head,[[i*.06-.12,.19,.11],[i*.06-.1,.12,.17],[i*.055-.13,.055,.18]],.033,'#d26324');
 const cape=g.node('cape',hips,[0,.34,-.12]);parts['cape']=cape;
 g.sphere('hood',cape,[0,.045,-.02],[.43,.2,.23],'#e4d8b5');
 for(const side of [-1,1]){
  const shoulder=g.leaf('ivory-mantle',cape,[side*.04,.03,.10],.4,.36,'#ecdfbf');shoulder.rotation.z=side*1.2;shoulder.rotation.x=.25;
  const cloth=g.leaf('cape-panel',cape,[side*.11,0,-.07],.46,.85,'#245e58');cloth.rotation.x=Math.PI+.15;cloth.rotation.z=side*.18;
  const trim=g.leaf('cape-ivory',cape,[side*.16,.005,-.10],.28,.7,'#d8cfad');trim.rotation.copyFrom(cloth.rotation);
  for(let i=0;i<3;i++){const motif=g.leaf('cape-motif',cape,[side*(.13+i*.025),-.17-i*.11,-.16],.09,.12,'#408b7b');motif.rotation.z=side*.6;}
 }
 g.gem('brooch',hips,[0,.39,.19],.105);
 const shield=g.node('shield',parts['arm-1']!,[0,-.32,.15]);parts['shield']=shield;
 g.shield('shield-rim',shield,[0,0,0],.61,.68,gold);g.shield('shield-wood',shield,[0,0,.03],.53,.60,'#44534a');
 g.gem('shield-core',shield,[0,.02,.135],.13);
 for(const s of [-1,1])g.tube('shield-rune',shield,[[0,-.27,.06],[s*.09,-.08,.09],[s*.2,.12,.055],[0,.31,.06]],.014,gold);
 g.tube('turquoise-rune',shield,[[0,-.20,.1],[0,.23,.1]],.009,teal,.65);
 const sword=g.node('sword',parts['arm1']!,[0,-.43,.03]);parts['sword']=sword;sword.rotation.x=-.25;
 g.cylinder('hilt',sword,[0,-.07,0],.18,.05,.05,wood);
 g.box('guard',sword,[0,-.15,0],[.25,.04,.06],gold);g.gem('hilt-gem',sword,[0,-.14,.04],.065);
 const blade=g.shield('blade',sword,[0,-.44,0],.10,.62,'#e3e9d7');blade.rotation.z=Math.PI;
 mergeRigidParts(root,parts);
 const meshes=root.getChildMeshes();
 return{root,parts,update(state,time){
  const p=state as Player;root.position.set(p.x,p.y,p.z);root.rotation.set(0,p.yaw,0);
  hips.position.y=.68+Math.sin(time*2.5)*.008;
  const moving=p.state==='run'||p.state==='walk',wave=Math.sin(time*(p.state==='run'?13:8));
  for(const s of [-1,1]){parts[`leg${s}`]!.rotation.x=moving?wave*s*.7:0;parts[`arm${s}`]!.rotation.set(moving?-wave*s*.4:0,0,s*-.07);}
  cape.rotation.x=.12+(moving?Math.abs(wave)*.16:Math.sin(time*2)*.025);head.rotation.y=0;shield.rotation.set(0,0,0);
  if(p.state==='jump'||p.state==='fall'){parts['leg1']!.rotation.x=-.65;parts['leg-1']!.rotation.x=.4;parts['arm1']!.rotation.x=-.5;}
  if(p.state==='land'){hips.position.y-=.10;parts['leg1']!.rotation.x=-.2;}
  if(p.state==='roll'){root.rotation.x=p.stateTime/.45*Math.PI*2;}
  if(p.attackTime>=0){const progress=Math.min(1,p.attackTime/(p.combo===3?.63:.5));parts['arm1']!.rotation.x=-1.2+Math.sin(progress*Math.PI)*2.8;parts['arm1']!.rotation.z=-.7+Math.sin(progress*Math.PI)*1.5;hips.rotation.y=Math.sin(progress*Math.PI)*.4;}else hips.rotation.y=0;
  if(p.shield){parts['arm-1']!.rotation.x=-1.1;parts['arm-1']!.rotation.y=-.25;shield.rotation.x=.7;}
  if(p.state==='hurt')root.rotation.z=Math.sin(time*35)*.12;
  if(p.state==='death'){root.rotation.z=Math.min(1,p.stateTime)*1.5;root.position.y+=.1;}
  if(p.state==='interact')parts['arm1']!.rotation.x=-1.25;
  if(p.state==='victory'){parts['arm1']!.rotation.x=-2.7;root.position.y+=Math.abs(Math.sin(time*4))*.12;}
  for(const m of meshes)m.visibility=p.invulnerable>0&&Math.sin(time*35)>0?.4:1;
 }};
}
export function createEnemyRig(g:Geometry,kind:'sprout'|'spirit'|'guardian',id:string):CharacterRig{
 const root=g.node(id),parts:Record<string,TransformNode>={};
 const body=g.node('body',root);parts['body']=body;
 if(kind==='sprout'){
  g.sphere('hunched-bark',body,[0,.57,-.08],[.95,.8,1.2],wood,0,9);
  for(let i=0;i<10;i++){const a=i*2.4;g.tube('twisted-root',body,[[Math.sin(a)*.39,.30,Math.cos(a)*.48],[Math.sin(a+.3)*.44,.69,Math.cos(a+.3)*.44],[Math.sin(a+.8)*.22,.92,Math.cos(a+.8)*.24]],.055,i%2?wood:'#987243');}
  const face=g.node('low-mask',body,[0,.43,.52]);parts['head']=face;
  g.shield('bark-mask',face,[0,0,0],.73,.56,'#9c7b43');
  for(const s of [-1,1]){const eye=g.sphere('amber-eye',face,[s*.19,.06,.09],[.16,.12,.055],'#ffc94d',1.5);eye.rotation.z=s*.3;
   const fore=g.node('large-forelimb',body,[s*.48,.51,.28]);parts[`arm${s}`]=fore;
   g.sphere('root-arm',fore,[0,-.2,.05],[.30,.5,.35],wood);g.sphere('claw-palm',fore,[0,-.42,.18],[.40,.18,.43],'#84623b');
   for(let c=0;c<3;c++)g.tube('root-finger',fore,[[c*.12-.12,-.4,.27],[c*.14-.14,-.44,.43],[c*.13-.13,-.44,.51]],.042,'#b59355');
   g.sphere('small-hindleg',body,[s*.34,.22,-.48],[.22,.4,.26],wood);
  }
  for(let i=0;i<18;i++){const a=i*2.4,x=Math.sin(a)*.4,z=Math.cos(a)*.5;const leaf=g.leaf('bark-leaf',body,[x,.75+(i%3)*.07,z],.22,.34,i%3?'#718038':'#b5903b');leaf.rotation.z=Math.sin(a)*1.2;leaf.rotation.x=Math.cos(a)*.7;g.cylinder('thorn',body,[x*.95,.91,z*.8],.18,.09,0,'#a7592a',5);}
 }else if(kind==='spirit'){
  g.sphere('luminous-core',body,[0,.28,0],[.75,.71,.63],'#59e6d3',.8,12);
  g.shield('wooden-mask',body,[0,.48,.28],.65,.5,'#9e7b45');
  for(const s of [-1,1]){g.sphere('eye-socket',body,[s*.20,.32,.29],[.30,.32,.08],'#1a6660');g.sphere('large-eye',body,[s*.2,.32,.34],[.19,.24,.055],'#a8fff0',1.4);}
  g.gem('forehead-gem',body,[0,.61,.32],.1);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;const leaf=g.leaf('leaf-crown',body,[Math.sin(a)*.3,.29+Math.cos(a)*.31,-.08],.25,i%2?.52:.4,i%2?'#528c35':'#76a345');leaf.rotation.z=-a;}
  for(const s of [-1,1]){const wing=g.leaf('energy-fin',body,[s*.33,.44,-.1],.29,.8,'#85ffe5',1);wing.rotation.z=-s*.7;parts[`arm${s}`]=wing;
   g.tube('energy-tail',body,[[s*.12,.05,0],[s*.25,-.28,-.05],[s*.32,-.45,.05],[s*.18,-.5,.15]],.035,'#79f4dc',1);}
 }else{
  g.sphere('root-torso',body,[0,2.5,0],[1.65,1.55,.9],wood,0,10);
  g.shield('stone-breastplate',body,[0,2.6,.48],1.55,1.2,stone);
  const head=g.node('stone-head',body,[0,3.4,.08]);parts['head']=head;
  g.shield('ancient-mask',head,[0,0,.1],.65,.9,'#b8b49c');
  for(const s of [-1,1]){g.sphere('turquoise-eye',head,[s*.16,.12,.19],[.20,.07,.04],teal,1.2);
   g.tube('crown-root',head,[[s*.23,.2,0],[s*.42,.6,-.1],[s*.28,.8,0]],.085,wood);
   const arm=g.node('massive-arm',body,[s*1.04,2.9,0]);parts[`arm${s}`]=arm;
   g.sphere('shoulder-stone',arm,[0,-.02,0],[1.0,.9,.95],stone,0,5);g.sphere('root-bicep',arm,[s*.12,-.63,0],[.57,.9,.63],wood);
   g.sphere('stone-forearm',arm,[s*.12,-1.14,.05],[.78,.95,.75],stone,0,5);
   g.sphere('giant-hand',arm,[s*.12,-1.7,.08],[.8,.6,.74],'#969782',0,6);
   for(let f=0;f<4;f++)g.box('stone-finger',arm,[s*.12+f*.16-.24,-1.9,.31],[.15,.3,.19],stone);
   const leg=g.node('leg',body,[s*.5,1.5,0]);parts[`leg${s}`]=leg;
   g.sphere('root-thigh',leg,[0,-.3,0],[.57,.8,.65],wood);g.sphere('stone-shin',leg,[0,-.88,.08],[.66,.9,.72],stone,0,5);g.sphere('stone-foot',leg,[0,-1.35,.25],[.85,.35,1],'#999b86',0,6);
   for(let i=0;i<3;i++){g.tube('arm-vine',arm,[[Math.sin(i*2)*.3,.25,Math.cos(i*2)*.35],[s*.2,-.7,.35],[s*.12+Math.sin(i*2)*.37,-1.4,.2]],.07,wood);}
   for(let i=0;i<7;i++){const leaf=g.leaf('shoulder-leaf',arm,[(i%3)*.22-.22,.30,-.12+Math.floor(i/3)*.21],.28,.35,moss);leaf.rotation.z=(i-3)*.2;}
   g.tube('arm-rune',arm,[[s*.12,-.75,.43],[s*.12-.15,-1.0,.46],[s*.12,-1.2,.46],[s*.12+.15,-1,.46],[s*.12,-.75,.43]],.018,teal,1);
  }
  for(let i=0;i<6;i++)g.tube('torso-vine',body,[[Math.sin(i)*.65,1.5,-.25],[Math.sin(i+.5)*.8,2.3,-.35],[Math.sin(i+1)*.9,3.2,-.3]],.10,wood);
  g.tube('chest-sigil',body,[[0,3,.59],[-.26,2.66,.62],[0,2.32,.62],[.26,2.66,.62],[0,3,.59]],.026,teal,1);g.gem('chest-core',body,[0,2.66,.65],.17);
  for(let i=0;i<8;i++)g.leaf('chest-moss',body,[i*.17-.6,3.08,.27],.23,.3,moss).rotation.x=2.3;
 }
 mergeRigidParts(root,parts);
 return{root,parts,update(state,time){
  const e=state as Enemy;root.position.set(e.x,e.y,e.z);root.rotation.y=e.yaw;
  body.position.y=kind==='spirit'?Math.sin(time*2.8)*.1:0;body.rotation.set(0,0,0);
  const walking=e.state==='chase'||e.state==='patrol';
  for(const s of [-1,1]){const arm=parts[`arm${s}`];if(arm)arm.rotation.x=walking?Math.sin(time*(kind==='guardian'?3:9))*s*.18:0;const leg=parts[`leg${s}`];if(leg)leg.rotation.x=walking?Math.sin(time*3)*s*.23:0;}
  if(e.state==='windup'){body.rotation.x=-.12;if(parts['arm1'])parts['arm1'].rotation.x=-1.8*Math.min(1,e.timer);if(kind==='guardian'&&e.attackIndex%2===1)parts['arm-1']!.rotation.x=-1.8*Math.min(1,e.timer);}
  if(e.state==='attack'){body.rotation.x=.18;if(parts['arm1'])parts['arm1'].rotation.x=.45;}
  if(e.hurt>0)body.rotation.z=Math.sin(time*40)*.10;
  if(kind==='spirit'){for(const s of [-1,1])parts[`arm${s}`]!.rotation.x=Math.sin(time*5)*.2;}
  if(e.hp<=0){root.scaling.y=Math.max(.01,1-e.timer*.9);root.scaling.x=root.scaling.z=Math.max(.01,1-e.timer*.5);if(e.timer>2)root.setEnabled(false);}else{root.setEnabled(true);root.scaling.setAll(1);}
 }};
}
