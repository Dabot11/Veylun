import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Geometry, type XYZ } from './geometry';
import { mergeRigidParts, type CharacterRig } from './characterRig';
import type { Player } from '../core/Simulation';
import { attackPose } from '../player/attackAnimation';

const ivory='#ecdfbf', lining='#245e58', leather='#80502e', brass='#bd934d';

/** Sewn, curved fabric with a broad hem, instead of leaf-shaped strips. */
function cloth(g:Geometry,parent:TransformNode,name:string,width:number,length:number,color:string,back=.015):void{
  const positions:number[]=[],indices:number[]=[];
  for(let row=0;row<=8;row++)for(let col=0;col<=10;col++){
    const t=row/8,u=col/10*2-1;
    positions.push(u*width*(.62+t*.38)/2,-t*length+Math.abs(u)*t*t*.08,
      back-t*.13-Math.cos(u*Math.PI*2)*.018*t+u*u*.075);
    if(row<8&&col<10){const a=row*11+col;indices.push(a,a+11,a+1,a+1,a+11,a+12);}
  }
  g.surface(name,parent,positions,indices,color);
}

export function createRuen(g:Geometry):CharacterRig{
  const root=g.node('ruen-provisional'),parts:Record<string,TransformNode>={};
  root.setPivotPoint(new Vector3(0,.66,0));
  const gem=(name:string,parent:TransformNode,pos:XYZ,size:number,color='#57e6dc')=>{
    const w=size*.5,h=size*.68,d=size*.25;
    const mesh=g.surface(name,parent,[0,h,0,w,0,0,0,-h,0,-w,0,0,0,0,d,0,0,-d],
      [0,1,4,1,2,4,2,3,4,3,0,4,1,0,5,2,1,5,3,2,5,0,3,5],color);
    mesh.position.set(...pos);mesh.material=g.mat(color,color===brass?0:.35);return mesh;
  };
  const hips=parts['hips']=g.node('hips',root,[0,.72,0]);
  g.sphere('tailored-tunic',hips,[0,.17,0],[.39,.44,.25],'#263f38',0,12);
  g.cylinder('leather-belt',hips,[0,-.015,0],.065,.39,.39,leather,16).scaling.z=.72;
  g.box('belt-buckle',hips,[0,-.015,.15],[.08,.065,.025],brass);
  g.box('buckle-inset',hips,[0,-.015,.165],[.05,.04,.01],leather);
  for(const side of [-1,1]){
    g.tube('crossed-harness',hips,[[side*.16,.35,.10],[side*.08,.21,.14],[-side*.14,.02,.13]],.022,leather);
    for(let i=0;i<4;i++)g.sphere('harness-stud',hips,[side*(.13-i*.065),.31-i*.08,.163],[.012,.012,.01],brass,0,4);
    const skirt=g.node('tunic-skirt',hips,[side*.12,-.03,.09]);skirt.rotation.z=side*.18;
    cloth(g,skirt,'ivory-skirt-border',.22,.21,ivory,.05);
    cloth(g,skirt,'tunic-skirt-panel',.18,.19,lining,.055);
    g.box('belt-pouch',hips,[side*.225,-.07,-.01],[.105,.16,.13],leather);
    g.box('pouch-flap',hips,[side*.225,-.02,.06],[.115,.06,.025],'#a16c3a');
    g.sphere('pouch-stud',hips,[side*.225,-.04,.08],[.022,.022,.01],brass);

    const leg=parts[`leg${side}`]=g.node(`thigh-${side}`,hips,[side*.105,-.07,0]);
    g.sphere('trouser-thigh',leg,[0,-.155,0],[.16,.36,.18],'#303831',0,10);
    const knee=parts[`knee${side}`]=g.node(`knee-${side}`,leg,[0,-.31,0]);
    g.sphere('trouser-knee',knee,[0,-.025,0],[.145,.15,.16],'#303831');
    g.cylinder('boot-shaft',knee,[0,-.16,0],.25,.155,.17,leather,12);
    g.cylinder('folded-boot-cuff',knee,[0,-.06,0],.07,.18,.20,'#a16c3a',12);
    g.sphere('boot-toe',knee,[0,-.275,.05],[.18,.13,.28],'#553b29',0,12);
    g.box('boot-sole',knee,[0,-.32,.04],[.18,.035,.27],'#342d24');
    g.tube('boot-strap',knee,[[-.08,-.23,.03],[0,-.23,.12],[.08,-.23,.03]],.015,leather);
    g.box('boot-buckle',knee,[.04,-.23,.12],[.045,.035,.012],brass);
    if(side===1){g.shield('knee-guard',knee,[0,.01,.09],.14,.14,brass);gem('knee-gem',knee,[0,.01,.11],.055);}

    const arm=parts[`arm${side}`]=g.node(`shoulder-${side}`,hips,[side*.235,.27,0]);
    g.sphere('short-sleeve',arm,[0,-.06,0],[.19,.18,.21],'#263f38',0,12);
    g.cylinder('sleeve-trim',arm,[0,-.12,0],.03,.155,.16,leather,12);
    g.sphere('upper-arm',arm,[0,-.17,0],[.105,.15,.115],'#d8a47d',0,12);
    const elbow=parts[`elbow${side}`]=g.node(`elbow-${side}`,arm,[0,-.22,0]);
    g.sphere('forearm',elbow,[0,-.07,0],[.105,.19,.12],'#d8a47d',0,12);
    g.cylinder('bracer',elbow,[0,-.09,0],.13,.12,.14,leather,8);
    for(const y of [-.035,-.145])g.cylinder('bracer-band',elbow,[0,y,0],.018,.145,.145,brass,8);
    gem('bracer-stone',elbow,[0,-.075,.078],.05);
    g.sphere('fingerless-glove',elbow,[0,-.195,.015],[.12,.115,.13],'#303831',0,10);
    for(let f=0;f<3;f++)g.sphere('knuckle',elbow,[(f-1)*.029,-.225,.05],[.026,.035,.03],'#d8a47d');
  }
  const flask=g.node('belt-flask',hips,[-.22,-.08,.09]);flask.rotation.z=-.25;
  g.cylinder('turquoise-flask',flask,[0,-.06,0],.12,.055,.055,'#35b9b5',8);
  for(const y of [-.12,0])g.cylinder('flask-band',flask,[0,y,0],.022,.07,.07,brass,8);
  gem('chest-jewel-setting',hips,[0,.22,.17],.10,brass);gem('chest-jewel',hips,[0,.22,.19],.067);

  const head=parts['head']=g.node('head',hips,[0,.49,0]);
  g.cylinder('neck',hips,[0,.36,0],.12,.13,.13,'#d8a47d');
  g.sphere('face',head,[0,0,.012],[.30,.32,.27],'#e0ad83',0,20);
  g.sphere('chin',head,[0,-.10,.057],[.20,.13,.18],'#e0ad83',0,12);
  g.sphere('nose',head,[0,-.025,.145],[.042,.06,.054],'#d89f74',0,10);
  g.tube('mouth',head,[[-.043,-.09,.142],[0,-.094,.15],[.043,-.09,.142]],.004,'#a7654c');
  for(const side of [-1,1]){
    g.sphere('ear',head,[side*.15,-.005,0],[.07,.10,.06],'#dba47b',0,12);
    g.sphere('ear-fold',head,[side*.164,-.005,.025],[.027,.05,.018],'#bc7f60');
    g.sphere('eye-socket',head,[side*.067,.018,.124],[.102,.078,.022],'#915536',0,12);
    g.sphere('eye-white',head,[side*.067,.019,.133],[.088,.062,.017],'#f7e8cb',0,12);
    g.sphere('amber-iris',head,[side*.064,.017,.142],[.041,.054,.012],'#9e592a',0,12);
    g.sphere('pupil',head,[side*.064,.017,.149],[.021,.039,.008],'#211c17',0,10);
    g.sphere('eye-glint',head,[side*.057,.032,.154],[.012,.013,.006],'#fff7da',.3);
    g.tapered('eyebrow',head,[[side*.025,.066,.147],[side*.07,.076,.145],[side*.115,.06,.132]],.012,'#792d17');
  }
  // Swept, tapering locks break the silhouette on the crown, sides and nape.
  g.sphere('hair-underlayer',head,[0,.07,-.04],[.34,.30,.29],'#89351d',0,14);
  for(let row=0;row<3;row++)for(let i=0;i<11;i++){
    const a=i*Math.PI*2/11+row*.29,r=.13+row*.015,y=.19-row*.065;
    if(row>0&&Math.cos(a+.4)>.2)continue;
    const points:XYZ[]=[];
    for(let j=0;j<=9;j++){
      const t=j/9,angle=a+t*.55,rad=r*(.55+t*.8);
      points.push([Math.sin(angle)*rad,y+Math.sin(t*Math.PI)*.025-t*(.09+row*.015),Math.cos(angle)*rad-.035]);
    }
    g.tapered('swept-copper-lock',head,points,.033,row===0?'#d96529':i%3?'#b74720':'#d96529');
  }
  for(let i=0;i<6;i++){
    const x=i*.047-.12,points:XYZ[]=[];
    for(let j=0;j<=8;j++){const t=j/8;points.push([x+.035*Math.sin(t*Math.PI),.18-t*(i%2?.13:.16),.08+Math.sin(t*1.5)*.10]);}
    g.tapered('parted-fringe',head,points,.032,i%2?'#c95122':'#e5752d');
  }

  const cape=parts['cape']=g.node('cape',hips,[0,.33,-.135]);
  cloth(g,cape,'petrol-cape-lining',.60,.72,lining,0);
  cloth(g,cape,'ivory-cape',.59,.55,ivory,-.014);
  // The rear emblem sits on the cloth's outside and remains visible from play camera.
  g.tube('dorsal-sigil',cape,[[0,-.12,-.047],[-.14,-.28,-.073],[0,-.46,-.14],[.14,-.28,-.073],[0,-.12,-.047]],.013,lining);
  gem('dorsal-gem',cape,[0,-.24,-.084],.07);
  for(const side of [-1,1])for(let i=0;i<3;i++){
    g.tube('embroidered-branch',cape,[[side*.025,-.23-i*.055,-.077-i*.012],[side*(.10+i*.025),-.19-i*.07,-.06-i*.014]],.009,lining);
  }
  g.sphere('folded-hood',cape,[0,-.018,-.025],[.37,.18,.19],ivory,0,14);
  g.tube('hood-seam',cape,[[0,.05,-.10],[0,-.025,-.12],[0,-.10,-.085]],.006,'#b7aa88');
  for(const side of [-1,1]){
    const shoulder=g.node('mantle-shoulder',hips,[side*.08,.37,.015]);shoulder.rotation.z=side*.85;
    cloth(g,shoulder,'ivory-shoulder-mantle',.26,.28,ivory,.04);
    g.tube('mantle-embroidery',shoulder,[[-.07,-.15,.025],[0,-.22,.015],[.07,-.15,.025]],.009,lining);
  }
  gem('brooch-setting',hips,[0,.35,.16],.11,brass);gem('turquoise-brooch',hips,[0,.35,.185],.073);

  const shield=parts['shield']=g.node('shield',parts['elbow-1']!,[0,-.10,.14]);
  g.shield('shield-rim',shield,[0,0,0],.53,.66,brass);
  g.shield('shield-wood',shield,[0,0,.018],.46,.58,'#344d46');
  for(const s of [-1,1]){
    g.tube('shield-gold-inlay',shield,[[0,-.30,.04],[s*.15,-.1,.07],[s*.22,.21,.04],[0,.35,.02]],.012,brass);
    for(let i=0;i<3;i++)g.tube('shield-vein',shield,[[0,-.14+i*.13,.115],[s*.12,.02+i*.1,.07]],.007,'#41c4bd',.2);
  }
  gem('shield-core-setting',shield,[0,0,.12],.15,brass);gem('shield-core',shield,[0,0,.15],.105);
  const sword=parts['sword']=g.node('sword',parts['elbow1']!,[0,-.21,.03]);sword.rotation.x=-.25;
  g.cylinder('sword-hilt',sword,[0,-.065,0],.17,.046,.046,'#463a2c',10);
  for(let i=0;i<4;i++)g.cylinder('hilt-wrap',sword,[0,-.015-i*.032,0],.009,.049,.049,leather,10);
  gem('pommel',sword,[0,.03,0],.055,brass);
  g.tapered('curved-sword-guard',sword,[[-.15,-.12,0],[-.11,-.105,0],[-.06,-.15,0],[0,-.16,0],[.06,-.15,0],[.11,-.105,0],[.15,-.12,0]],.026,brass);
  gem('hilt-gem',sword,[0,-.14,.035],.066);
  // Four faces meet at a raised ridge, with the actual tip matching the rig contract.
  for(const side of [-1,1])for(const face of [-1,1])g.surface('faceted-blade',sword,
    [0,-.18,face*.017,side*.045,-.18,0,side*.04,-.64,0,0,-.78,0,0,-.64,face*.018],
    [0,1,2,0,2,4,4,2,3],side===face?'#e3e9d7':'#aebfbc');
  g.tube('sword-charm-chain',sword,[[-.09,-.14,0],[-.13,-.22,0],[-.12,-.28,0]],.007,brass);
  gem('sword-charm',sword,[-.12,-.30,0],.045);
  mergeRigidParts(root,parts);
  const meshes=root.getChildMeshes();
  let stride=0,lastTime=0;
  return{root,parts,update(state,time){
    const p=state as Player,dt=Math.max(0,Math.min(.1,time-lastTime));lastTime=time;
    const speed=Math.hypot(p.vx,p.vz),moving=(p.state==='run'||p.state==='walk')&&speed>.05;
    if(moving)stride+=dt*speed*2.8;
    const wave=Math.sin(stride),breath=Math.sin(time*2.5);
    root.position.set(p.x,p.y,p.z);root.rotation.set(0,p.yaw,0);
    hips.position.set(0,.72+(moving?Math.abs(wave)*.022:breath*.004),0);hips.rotation.set(0,0,0);
    head.rotation.set(0,0,0);cape.rotation.set(moving?.18+Math.abs(wave)*.12:breath*.018,0,moving?wave*.04:0);
    sword.rotation.set(p.attackTime>=0?-.25:-.55,0,p.attackTime>=0?0:.6);
    shield.rotation.set(0,0,0);
    for(const s of [-1,1]){
      parts[`leg${s}`]!.rotation.set(moving?wave*s*.55:0,0,0);
      parts[`knee${s}`]!.rotation.x=moving?Math.max(0,wave*s)*.72:0;
      parts[`arm${s}`]!.rotation.set(moving?-wave*s*.28:-.03,0,-s*.09);
      parts[`elbow${s}`]!.rotation.x=moving?-.22:-.08;
    }
    if(moving){hips.rotation.y=wave*.045;head.rotation.y=-wave*.025;}
    if(p.state==='jump'||p.state==='fall'){
      parts['leg1']!.rotation.x=-.45;parts['leg-1']!.rotation.x=.3;
      parts['knee1']!.rotation.x=.8;parts['knee-1']!.rotation.x=.5;parts['arm1']!.rotation.x=-.5;
      cape.rotation.x=.35;
    }
    if(p.state==='land'){hips.position.y-=.07;for(const s of [-1,1]){parts[`leg${s}`]!.rotation.x=-.35;parts[`knee${s}`]!.rotation.x=.65;}}
    if(p.state==='roll'){
      const tuck=Math.sin(Math.min(1,p.stateTime/.45)*Math.PI);
      root.rotation.x=p.stateTime/.45*Math.PI*2;hips.position.y-=tuck*.13;head.rotation.x=.3*tuck;cape.rotation.x=.25*tuck;
      for(const s of [-1,1]){parts[`leg${s}`]!.rotation.x=-.9*tuck;parts[`knee${s}`]!.rotation.x=1.5*tuck;parts[`arm${s}`]!.rotation.x=-.6*tuck;parts[`elbow${s}`]!.rotation.x=-.8*tuck;}
    }
    if(p.attackTime>=0){
      const pose=attackPose(p.combo,p.attackTime);parts['arm1']!.rotation.set(pose.x,pose.y,pose.z);
      parts['elbow1']!.rotation.x=0;hips.rotation.y=pose.torso;
      parts['arm-1']!.rotation.x=-.25;parts['elbow-1']!.rotation.x=-.25;
      parts['leg1']!.rotation.x=-.12;parts['knee1']!.rotation.x=.18;cape.rotation.y=-pose.torso*.6;
    }
    if(p.shield){
      parts['arm-1']!.rotation.set(-.65,-.15,.1);parts['elbow-1']!.rotation.x=-.7;shield.rotation.x=1.15;
      hips.position.y-=.025;parts['leg-1']!.rotation.x=.16;parts['knee-1']!.rotation.x=.2;
    }
    if(p.state==='hurt')root.rotation.z=Math.sin(time*35)*.12;
    if(p.state==='death'){root.rotation.z=Math.min(1,p.stateTime)*1.5;root.position.y+=.1;}
    if(p.state==='interact'){parts['arm1']!.rotation.x=-.8;parts['elbow1']!.rotation.x=-.45;}
    if(p.state==='victory'){parts['arm1']!.rotation.x=-2.7;root.position.y+=Math.abs(Math.sin(time*4))*.12;}
    for(const m of meshes)m.visibility=p.invulnerable>0&&Math.sin(time*35)>0?.4:1;
  }};
}
