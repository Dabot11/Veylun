import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import type { Geometry } from '../assets/geometry';
import type { Simulation } from '../core/Simulation';
import { spiritCombat } from '../enemies/spiritCombat';
import { groundHeight } from './level';

/** Spell cues and a bounded pool; the simulation owns aim, motion and damage. */
export class SpiritView {
  private charge: TransformNode;
  private core: Mesh;
  private direction: TransformNode;
  private recovery: Mesh;
  private shots: TransformNode[];

  constructor(private g: Geometry) {
    this.charge=g.node('spirit-charge');
    this.core=g.sphere('spell-charge-core',this.charge,[0,0,0],[.35,.35,.35],'#fff0b0',1,8);
    const halo=g.sphere('spell-charge-aura',this.charge,[0,0,0],[.58,.58,.58],'#48ceb8',.8,8);
    halo.material=g.mat('#48ceb8',.8,.3);
    const ring=CreateTorus('spell-charge-ring',{diameter:.72,thickness:.025,tessellation:32},g.scene);
    g.place(ring,this.charge,[0,0,0],[1,1,1],'#ffe4a1',1);ring.rotation.x=Math.PI/2;
    this.direction=g.node('spirit-aim');
    for(let i=0;i<3;i++)g.box('spell-aim-dash',this.direction,[0,0,.35+i*.3],[.025,.015,.16],'#ffe4a1',.6);
    this.recovery=CreateTorus('spirit-recovery',{diameter:1.3,thickness:.035,tessellation:40},g.scene);
    g.place(this.recovery,null,[0,0,0],[1,1,1],'#a2ebc4',.7);
    this.shots=Array.from({length:4},()=>{
      const root=g.node('spirit-projectile');
      g.sphere('spell-core',root,[0,0,0],[.27,.27,.27],'#fff0b0',1,6);
      const shell=g.sphere('spell-aura',root,[0,0,0],[.4,.4,.4],'#48ceb8',.8,6);
      shell.material=g.mat('#48ceb8',.8,.3);
      g.sphere('spell-tail',root,[0,0,-.25],[.16,.16,.32],'#97efdb',.8,5);
      g.sphere('spell-tail-tip',root,[0,0,-.52],[.08,.08,.24],'#97efdb',.8,5);
      root.setEnabled(false);return root;
    });
    this.charge.setEnabled(false);this.direction.setEnabled(false);this.recovery.setEnabled(false);
  }

  update(sim: Simulation): void {
    const enemy=sim.enemies.find(e=>e.kind==='spirit');
    const charging=!!enemy&&enemy.hp>0&&enemy.state==='windup'&&sim.mode==='playing';
    this.charge.setEnabled(charging);this.direction.setEnabled(charging);
    this.recovery.setEnabled(!!enemy&&enemy.hp>0&&enemy.state==='recover'&&sim.mode==='playing');
    if(enemy){
      const y=groundHeight(enemy.x,enemy.z),dx=Math.sin(enemy.yaw),dz=Math.cos(enemy.yaw);
      const progress=Math.min(1,enemy.timer/spiritCombat.windup);
      this.charge.position.set(enemy.x+dx*spiritCombat.muzzleOffset,y+spiritCombat.projectileHeight,enemy.z+dz*spiritCombat.muzzleOffset);
      this.charge.rotation.y=enemy.yaw;this.charge.scaling.setAll(.35+progress*.75);
      this.core.material=this.g.mat(enemy.timer>=spiritCombat.aimLockTime?'#fff0b0':'#97efdb',1);
      this.direction.position.set(enemy.x,y+.07,enemy.z);this.direction.rotation.y=enemy.yaw;
      this.direction.scaling.z=Math.max(1,Math.min(10,Math.hypot(enemy.aim.x-enemy.x,enemy.aim.z-enemy.z)));
      this.recovery.position.set(enemy.x,y+.06,enemy.z);this.recovery.scaling.setAll(1+Math.sin(sim.age*4)*.06);
    }
    this.shots.forEach((root,i)=>{
      const shot=sim.projectiles[i];root.setEnabled(!!shot&&sim.mode==='playing');
      if(shot){root.position.set(shot.x,shot.y,shot.z);root.rotation.y=Math.atan2(shot.vx,shot.vz);}
    });
  }
}
