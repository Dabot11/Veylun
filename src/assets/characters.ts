import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import '@babylonjs/core/Rendering/outlineRenderer';
import { Geometry } from './geometry';
import type { Enemy } from '../core/Simulation';
import { spiritCombat } from '../enemies/spiritCombat';
import { guardianAttack } from '../enemies/guardianCombat';
import { mergeRigidParts, type CharacterRig } from './characterRig';
export type { CharacterRig } from './characterRig';
export { createRuen } from './ruen';
const wood='#775232',moss='#71833c',teal='#41e3cf',stone='#8c9380';
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
 const meshes=root.getChildMeshes();
 for(const mesh of meshes){mesh.overlayColor=Color3.FromHexString('#fff1bd');mesh.overlayAlpha=.4;}
 return{root,parts,update(state,time){
  const e=state as Enemy;root.position.set(e.x,e.y,e.z);root.rotation.y=e.yaw;
  body.position.y=kind==='spirit'?Math.sin(time*2.8)*.1:0;body.position.z=0;body.rotation.set(0,0,0);
  const walking=e.state==='chase'||e.state==='patrol';
  for(const s of [-1,1]){const arm=parts[`arm${s}`];if(arm)arm.rotation.x=walking?Math.sin(time*(kind==='guardian'?3:9))*s*.18:0;const leg=parts[`leg${s}`];if(leg)leg.rotation.x=walking?Math.sin(time*3)*s*.23:0;}
  if(e.state==='windup'){body.rotation.x=-.12;if(parts['arm1'])parts['arm1'].rotation.x=-1.8*Math.min(1,e.timer);if(kind==='guardian'&&e.attackIndex%2===1)parts['arm-1']!.rotation.x=-1.8*Math.min(1,e.timer);}
  if(e.state==='attack'){body.rotation.x=.18;if(parts['arm1'])parts['arm1'].rotation.x=.45;}
  if(e.hurt>0){const reaction=e.hurt/.28;body.rotation.z=Math.sin(time*40)*.07*reaction;body.position.z=-.16*reaction;body.rotation.x-=.14*reaction;}
  for(const mesh of meshes)mesh.renderOverlay=e.hurt>.14;
  if(kind==='spirit'){
    const charge=e.state==='windup'?Math.min(1,e.timer/spiritCombat.windup):0,recover=e.state==='recover';
    body.position.y+=charge*.12-(recover?.12:0);
    for(const s of [-1,1]){parts[`arm${s}`]!.rotation.x=charge?-.45*charge:recover?.35:Math.sin(time*5)*.2;parts[`arm${s}`]!.rotation.z=-s*(recover?1.7:.7-charge*.5);}
  }
  if(kind==='guardian'){
    const attack=guardianAttack(e.attackIndex),slam=attack.kind==='slam';
    for(const s of [-1,1]){parts[`arm${s}`]!.rotation.y=0;parts[`arm${s}`]!.rotation.z=0;}
    if(e.state==='windup'){
      const charge=Math.min(1,e.timer/attack.windup);body.rotation.x=-.12*charge;
      parts['arm1']!.rotation.x=-2.4*charge;
      if(slam)parts['arm-1']!.rotation.x=-2.4*charge;
      else parts['arm1']!.rotation.y=-.65*charge;
    }else if(e.state==='attack'||e.state==='recover'){
      const strike=e.state==='attack'?Math.min(1,e.timer/attack.impact):1;
      const rise=e.state==='recover'?Math.max(0,(e.timer/attack.recovery-.65)/.35):0;
      body.position.y=-(slam?.7:.2)*strike*(1-rise);body.rotation.x=.22*strike*(1-rise);
      parts['arm1']!.rotation.x=(-2.4+strike*(slam?2.25:1.3))*(1-rise);
      if(slam)parts['arm-1']!.rotation.x=parts['arm1']!.rotation.x;
      else parts['arm1']!.rotation.y=-.65*(1-strike);
    }
    // A deliberate kneel and fade replaces the generic shrinking death.
    if(e.hp<=0){const fall=Math.min(1,e.timer/1.2);body.position.y=-1.2*fall;body.rotation.x=.45*fall;
      parts['arm1']!.rotation.x=parts['arm-1']!.rotation.x=-.25;
      for(const mesh of meshes)mesh.visibility=Math.max(0,1-Math.max(0,e.timer-1.4)/.8);
      root.setEnabled(e.timer<2.2);root.scaling.setAll(1);
    }else{for(const mesh of meshes)mesh.visibility=1;root.setEnabled(true);root.scaling.setAll(1);}
  }else if(e.hp<=0){root.scaling.y=Math.max(.01,1-e.timer*.9);root.scaling.x=root.scaling.z=Math.max(.01,1-e.timer*.5);if(e.timer>2)root.setEnabled(false);}else{root.setEnabled(true);root.scaling.setAll(1);}
 }};
}
