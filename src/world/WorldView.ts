import { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { VisualOverrides } from '../assets/VisualOverrides';
import { Geometry } from '../assets/geometry';
import { createRuen, createEnemyRig, type CharacterRig } from '../assets/characters';
import { groundHeight, obstacles, interactables, zones } from './level';
import { seededRandom } from '../core/math';
import type { Simulation } from '../core/Simulation';
import { CombatEffects } from './CombatEffects';
import { SpiritView } from './SpiritView';
import { GuardianView } from './GuardianView';
import { SanctuaryView } from './SanctuaryView';
export class WorldView {
  readonly visualOverrides=new VisualOverrides();readonly g:Geometry;readonly hero:CharacterRig;readonly enemyRigs:CharacterRig[];
  private seal:TransformNode;private gate:TransformNode;private grate:TransformNode;private lid:TransformNode;private switchGem:Mesh;private altar:Mesh;
  private telegraphs:Mesh[]=[];private targetRing:Mesh;private destination:Mesh;private motes:Mesh[]=[];
  readonly spiritView:SpiritView;
  readonly guardianView:GuardianView;
  readonly sanctuaryView:SanctuaryView;
  private switchBeacon:TransformNode;
  readonly shadowCasters:Mesh[]=[];
  readonly combatEffects:CombatEffects;
  private chargeArrows=new Map<string,TransformNode>();
  constructor(readonly scene:Scene,sim:Simulation){
    this.g=new Geometry(scene);const g=this.g,random=seededRandom(84721);
    this.terrain();
    const staticStart=scene.meshes.length;
    // Dense perimeter with individually shaped roots and broad canopies.
    for(const o of obstacles){
      const y=groundHeight(o.x,o.z);
      if(o.kind==='tree'){
        const height=7+random()*5;
        g.cylinder(o.id,null,[o.x,y+height/2,o.z],height,o.w*1.35,o.w*.4,'#615439',9);
        for(let i=0;i<5;i++){
          const a=i*Math.PI*.4+random();
          const dx=Math.sin(a),dz=Math.cos(a);
          g.tube('tree-root',null,[[o.x,y+1.4,o.z],[o.x+dx*.8,y+.35,o.z+dz*.8],[o.x+dx*2,y+.05,o.z+dz*2]],.20,'#6c5b38');
          const bx=o.x+dx*2.4,bz=o.z+dz*2.4;
          g.tube('branch',null,[[o.x,y+height*.55,o.z],[o.x+dx*1.5,y+height*.8,o.z+dz*1.5],[bx,y+height,bz]],.19,'#615439');
          g.sphere('canopy',null,[bx,y+height,bz],[4.8,2.6,4.5],i%2?'#688743':'#3e6744',0,6);
          g.sphere('sunlit-leaves',null,[bx-.5,y+height+.8,bz],[3.6,1.6,3.6],'#7d944b',0,6);
        }
      }else if(o.kind==='rock'){
        const rock=g.sphere(o.id,null,[o.x,y+o.height*.35,o.z],[o.w,o.height*1.1,o.d],'#8f9980',0,4);rock.rotation.y=random()*3;
        g.sphere('rock-moss',null,[o.x,y+o.height*.7,o.z],[o.w*.8,.25,o.d*.8],'#6f883e',0,5);
      }else if(o.kind==='wall'){
        for(let h=0;h<4;h++)g.box(o.id,null,[o.x,y+h*.9+.4,o.z],[o.w,.85,o.d],'#959b85');
        g.box('wall-moss',null,[o.x,y+3.7,o.z],[o.w+.2,.15,o.d+.2],'#6a873e');
      }
    }
    for(const zone of zones){
      const z=zone.z;
      for(let i=0;i<50;i++){
        const angle=random()*Math.PI*2,r=1+random()*7;
        const x=Math.cos(angle)*r,sz=z+Math.sin(angle)*r;
        const tile=g.cylinder('ancient-paving',null,[x,groundHeight(x,sz)+.015,sz],.08,.8+random()*.5,.8+random()*.5,i%3?'#a8af8c':'#939e7e',6);tile.rotation.y=random()*6;
      }
      for(const side of [-1,1])for(const offset of [-5,5])this.pillar(side*7,z+offset,2.5+random()*1.8);
    }
    for(const [z,r] of [[0,2.2],[113,7],[126,1.5]]){
      const floor=groundHeight(0,z!);
      g.cylinder('ritual-dais',null,[0,floor-.005,z!],.04,r!*2,r!*2,'#adb293',32);
      const ring=CreateTorus('engraved-ring',{diameter:r!*1.7,thickness:.035,tessellation:64},scene);g.place(ring,null,[0,floor+.022,z!],[1,1,1],'#5ba797',.15);
    }
    // Ruined arch marking the first path.
    this.arch(0,15,3.2);this.arch(0,43,3.1);this.arch(0,90,4.1);
    for(let i=0;i<650;i++){
      const z=-9+random()*140,x=(random()>.5?1:-1)*(4+random()*10);if(z>97&&Math.abs(x)<9)continue;
      const y=groundHeight(x,z);
      for(let j=0;j<3;j++){
        const leaf=g.leaf('fern',null,[x,y,z],.16+random()*.18,.35+random()*.65,j%2?'#6d994e':'#4b7848');leaf.rotation.y=random()*6;leaf.rotation.z=(random()-.5)*1.5;
      }
      if(i%3===0){
        g.cylinder('flower-stem',null,[x,y+.18,z],.36,.018,.018,'#577e4d',4);
        for(let petal=0;petal<5;petal++)g.sphere('flower',null,[x+Math.cos(petal*1.256)*.065,y+.37,z+Math.sin(petal*1.256)*.065],[.10,.045,.12],i%2?'#d1eaf0':'#a9c6da',.1,4);
      }
    }
    // Cliffs, waterfalls and silhouettes beyond the playable forest.
    for(const side of [-1,1])for(let i=0;i<12;i++){
      const z=i*14-14,x=side*(24+random()*6),h=8+random()*14;
      g.sphere('distant-cliff',null,[x,h*.35,z],[12,h,15],'#849a86',0,4);
      g.sphere('cliff-crown',null,[x,h*.75,z],[11,2,12],'#618451',0,5);
      if(i%3===0){g.box('waterfall',null,[x-side*4,h*.36,z],[1.2,h*.8,.12],'#b6e7dc',.25);g.sphere('water-mist',null,[x-side*4,.2,z],[3,.3,4],'#a1d5c3',.15);}
    }
    const staticMeshes=scene.meshes.slice(staticStart).filter((m):m is Mesh=>m instanceof Mesh);
    const byMaterial=new Map<string,Mesh[]>();
    for(const m of staticMeshes){const k=m.material?.name??'';const list=byMaterial.get(k)??[];list.push(m);byMaterial.set(k,list);}
    for(const list of byMaterial.values()){
      const merged=Mesh.MergeMeshes(list,true,true,undefined,false,true);if(merged){merged.isPickable=false;merged.freezeWorldMatrix();merged.receiveShadows=true;}
    }
    // Dynamic architecture stays separate from merged scenery.
    this.seal=g.node('root-seal');
    for(let i=0;i<9;i++){const x=i*3.5-14;g.tube('sealed-roots',this.seal,[[x,0,41],[x+1,2.1,41],[x+2,3.6,41],[x+3.5,0,41]],.1,'#4e7860');}
    const veil=g.box('root-seal-magic',this.seal,[0,1.7,41],[30,3.4,.04],'#6fbf9b',.3);veil.material=g.mat('#6fbf9b',.3,.18);
    this.gate=g.node('sanctuary-gate',undefined,[0,groundHeight(0,90),90]);
    for(const side of [-1,1]){g.box('door-stone',this.gate,[side*1.48,2.6,0],[2.9,5.2,.5],'#667e70');g.tube('door-rune',this.gate,[[side*1.48,.5,-.28],[side*.65,2.4,-.28],[side*1.48,4.6,-.28]],.045,'#59dac9',.6);}
    this.grate=g.node('ruins-grate',undefined,[10,groundHeight(10,57),57]);
    for(let i=0;i<13;i++)g.cylinder('grate-bar',this.grate,[i*.46-2.76,1.7,0],3.4,.08,.08,'#566d60',6);
    g.box('grate-top',this.grate,[0,3.4,0],[6,.14,.15],'#566d60');
    const chest=g.node('key-chest',undefined,[10,groundHeight(10,61),61]);
    g.box('chest-body',chest,[0,.32,0],[1.1,.6,.7],'#765338');
    for(const side of [-1,1])g.box('chest-band',chest,[side*.36,.34,.37],[.10,.6,.04],'#c6a66a');
    this.lid=g.node('chest-lid',chest,[0,.64,-.35]);g.box('chest-lid-wood',this.lid,[0,.08,.35],[1.12,.18,.74],'#956d42');g.gem('chest-lock',chest,[0,.42,.39],.13);
    const sw=interactables['ruins-switch'];g.cylinder('switch-plinth',null,[sw.x,groundHeight(sw.x,sw.z)+.4,sw.z],.8,.7,.55,'#a0a78d',8);
    this.switchGem=g.gem('switch-crystal',null,[sw.x,groundHeight(sw.x,sw.z)+1,sw.z],.28);
    this.switchBeacon=g.node('ruins-switch-beacon',undefined,[sw.x,groundHeight(sw.x,sw.z),sw.z]);
    const beam=g.box('switch-light-column',this.switchBeacon,[0,1.7,0],[.07,2.8,.07],'#ffe4a1',.8);beam.material=g.mat('#ffe4a1',.8,.45);
    g.gem('switch-guide-diamond',this.switchBeacon,[0,2.9,0],.2,'#ffe4a1');
    const switchRing=CreateTorus('switch-ready-ring',{diameter:1.5,thickness:.04,tessellation:40},scene);
    g.place(switchRing,this.switchBeacon,[0,.08,0],[1,1,1],'#ffe4a1',.8);this.switchBeacon.setEnabled(false);
    g.cylinder('altar-base',null,[0,groundHeight(0,126)+.5,126],1,1.6,1.25,'#929b85',8);
    this.altar=g.gem('altar-heart',null,[0,groundHeight(0,126)+1.4,126],.58);
    this.hero=createRuen(g);this.enemyRigs=sim.enemies.map(e=>createEnemyRig(g,e.kind,e.id));
    for(const rig of [this.hero,...this.enemyRigs])for(const m of rig.root.getChildMeshes())if(m instanceof Mesh)this.shadowCasters.push(m);
    for(const e of sim.enemies){const ring=CreateTorus('attack-warning',{diameter:e.kind==='guardian'?8.6:3.5,thickness:.055,tessellation:48},scene);ring.material=g.mat('#f4a45b',.7);ring.isPickable=false;this.telegraphs.push(ring);}
    this.targetRing=CreateTorus('target-ring',{diameter:1.5,thickness:.035,tessellation:48},scene);this.targetRing.material=g.mat('#fff3ba',.8);this.targetRing.isPickable=false;
    this.combatEffects=new CombatEffects(g);
    this.spiritView=new SpiritView(g);
    this.guardianView=new GuardianView(g);this.sanctuaryView=new SanctuaryView(g);
    for(const e of sim.enemies.filter(e=>e.kind==='sprout')){
      const arrow=g.node('charge-direction');
      g.box('charge-path',arrow,[0,0,1.5],[.07,.025,2.4],'#ffc178',.6);
      g.tube('charge-arrow',arrow,[[-.4,0,2.25],[0,0,2.8],[.4,0,2.25]],.045,'#ffc178',.6);
      arrow.setEnabled(false);this.chargeArrows.set(e.id,arrow);
    }
    this.destination=g.gem('guiding-wisp',null,[0,1,20],.15,'#93ecd9');
    for(let i=0;i<35;i++)this.motes.push(g.sphere('forest-mote',null,[0,0,0],[.025,.025,.025],i%3?'#bfde9a':'#73e6db',.6,3));
  }
  private pillar(x:number,z:number,height:number):void{
    const g=this.g,y=groundHeight(x,z);
    g.box('pillar-foot',null,[x,y+.12,z],[1.1,.24,1.1],'#a3aa91');
    for(let h=0;h<height;h+=.7)g.cylinder('pillar-stone',null,[x,y+h+.55,z],.65,.65,.6,'#a6ac91',7);
    g.box('pillar-cap',null,[x,y+height+.3,z],[.95,.2,.95],'#7e9262');
    g.tube('pillar-rune',null,[[x-.12,y+.7,z-.34],[x+.12,y+1,z-.34],[x-.12,y+1.3,z-.34],[x+.12,y+1.6,z-.34]],.018,'#53c8b8',.5);
  }
  private arch(x:number,z:number,r:number):void{
    this.pillar(x-r,z,r);this.pillar(x+r,z,r);
    for(let i=0;i<11;i++){if(i===8&&z!==90)continue;const a=i*Math.PI/10;const block=this.g.box('arch-block',null,[x+Math.cos(a)*r,groundHeight(x,z)+r+Math.sin(a)*r,z],[.8,1.1,.85],'#a4ab92');block.rotation.z=a-Math.PI/2;}
  }
  private terrain():void{
    const m=new Mesh('forest-ground',this.scene),v=new VertexData(),positions:number[]=[],indices:number[]=[],colors:number[]=[];
    const width=50,depth=150;
    for(let iz=0;iz<=depth;iz++)for(let ix=0;ix<=width;ix++){
      const x=ix-width/2,z=iz-12;positions.push(x,groundHeight(x,z)-.04,z);
      const path=Math.abs(x-Math.sin(z*.13)*1.2)<2.3;
      const patch=.03*Math.sin(x*1.6+z*.7)+.02*Math.sin(z*2.5);
      colors.push((path?.48:.26)+patch,(path?.49:.40)+patch,(path?.30:.21)+patch,1);
      if(ix<width&&iz<depth){const a=iz*(width+1)+ix;indices.push(a,a+1,a+width+1,a+1,a+width+2,a+width+1);}
    }
    v.positions=positions;v.indices=indices;v.colors=colors;v.normals=[];VertexData.ComputeNormals(positions,indices,v.normals);v.applyToMesh(m);m.material=this.g.mat('#ffffff');m.receiveShadows=true;m.isPickable=false;
  }
  update(sim:Simulation,dt:number):void{
    const t=sim.age;this.visualOverrides.update(sim);
    this.spiritView.update(sim);
    this.guardianView.update(sim);this.sanctuaryView.update(sim);
    this.combatEffects.update(dt);
    for(const e of sim.enemies){const arrow=this.chargeArrows.get(e.id);if(arrow){arrow.setEnabled(sim.mode==='playing'&&e.hp>0&&e.state==='windup');arrow.position.set(e.x,groundHeight(e.x,e.z)+.1,e.z);arrow.rotation.y=e.yaw;}}
    this.seal.setEnabled(!(sim.save.defeatedOrdinaryEnemies.includes('sprout-1')&&sim.save.defeatedOrdinaryEnemies.includes('sprout-2')));
    this.hero.update(sim.player,t);this.enemyRigs.forEach((r,i)=>r.update(sim.enemies[i]!,t));
    this.gate.position.y+=( (sim.save.doorUnlocked?-6:groundHeight(0,90))-this.gate.position.y)*Math.min(1,dt*2);
    this.grate.position.y+=((sim.save.grateOpened?-4:groundHeight(10,57))-this.grate.position.y)*Math.min(1,dt*3);
    this.lid.rotation.x+=((sim.save.chestOpened?-1.7:0)-this.lid.rotation.x)*Math.min(1,dt*4);
    this.switchGem.rotation.y=t*.5;
    this.switchGem.material=this.g.mat(sim.save.switchActivated?'#b8f3a1':sim.ruinsSwitchReady?'#ffe4a1':'#396b64',sim.ruinsSwitchReady?.9:.2);
    this.switchGem.scaling.setAll(.28*(sim.ruinsSwitchReady?1+Math.sin(t*3)*.12:1));this.switchGem.scaling.y*=1.35;this.switchGem.scaling.z*=.55;
    this.switchBeacon.setEnabled(sim.ruinsSwitchReady&&sim.mode==='playing');
    this.altar.rotation.y=t*.35;this.altar.scaling.set(.58*(1+sim.restorationProgress*.25),.58*1.35*(1+sim.restorationProgress*.25),.58*.55*(1+sim.restorationProgress*.25));this.altar.material=this.g.mat(sim.save.bossDefeated?'#88ffe2':'#468b83',sim.save.bossDefeated?1:.15);
    this.telegraphs.forEach((m,i)=>{const e=sim.enemies[i]!;m.setEnabled(e.kind==='sprout'&&e.hp>0&&(e.state==='windup'||e.state==='attack'));m.position.set(e.x,groundHeight(e.x,e.z)+.08,e.z);m.visibility=e.state==='windup'?.4+Math.sin(t*12)*.2:.85;});
    const target=sim.target;this.targetRing.setEnabled(!!target);if(target)this.targetRing.position.set(target.x,groundHeight(target.x,target.z)+.09,target.z);
    const goal=sim.objectivePosition(),dx=goal.x-sim.player.x,dz=goal.z-sim.player.z,len=Math.hypot(dx,dz);
    this.destination.position.set(sim.player.x+dx/Math.max(1,len)*Math.min(4,len),sim.player.y+1.3+Math.sin(t*2)*.1,sim.player.z+dz/Math.max(1,len)*Math.min(4,len));this.destination.rotation.y=t;this.destination.setEnabled(len>4&&sim.mode==='playing');
    this.motes.forEach((m,i)=>m.position.set(sim.player.x+Math.sin(i*2.4+t*.08)*9,1.5+Math.sin(i+t*.3)*1.1,sim.player.z+Math.cos(i*2.4+t*.05)*12));
  }
}
