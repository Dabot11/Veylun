import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { Simulation } from '../core/Simulation';
import { obstacles, solid, groundHeight } from '../world/level';
import { angleDelta, angleTo, clamp, distance } from '../core/math';
export class FollowCamera {
 readonly camera:FreeCamera;yaw=0;pitch=.28;distance=5.8;sensitivity=1;invert=false;
 private currentDistance=5.8;private target=new Vector3();private manualLookTime=0;private combatFraming=0;
 constructor(scene:Scene){this.camera=new FreeCamera('follow-camera',new Vector3(0,3,-6),scene);this.camera.minZ=.08;this.camera.maxZ=90;this.camera.fov=.9;this.camera.inputs.clear();}
 reset(sim:Simulation):void{this.yaw=sim.player.yaw;this.pitch=.28;this.manualLookTime=0;this.combatFraming=0;this.target.set(sim.player.x,sim.player.y+1,sim.player.z);this.currentDistance=this.distance;this.update(sim,1,{x:0,y:0},0);}
 update(sim:Simulation,dt:number,look:{x:number;y:number},zoom:number):void{
  const p=sim.player;this.yaw+=look.x;this.pitch=clamp(this.pitch+look.y,-.12,1.05);this.distance=clamp(this.distance+zoom*.003,3,8);
  this.manualLookTime=Math.abs(look.x)+Math.abs(look.y)>.001?.65:Math.max(0,this.manualLookTime-dt);
  this.combatFraming+=((sim.target?1:0)-this.combatFraming)*(1-Math.exp(-5*dt));
  let tx=p.x,ty=p.y+1,tz=p.z,wantedDistance=this.distance;
  if(sim.target){
   const e=sim.target;
   if(this.manualLookTime===0)this.yaw+=angleDelta(this.yaw,angleTo(p,e))*(1-Math.exp(-4*dt));
   tx=p.x*.7+e.x*.3;tz=p.z*.7+e.z*.3;ty=p.y+1.1;
   wantedDistance=Math.max(this.distance,Math.min(10.5,3+distance(p,e)*.55));
  }
  const shoulder=.85*Math.min(1,this.camera.getEngine().getAspectRatio(this.camera))*this.combatFraming;
  tx+=Math.cos(this.yaw)*shoulder;tz-=Math.sin(this.yaw)*shoulder;
  this.target.x+=(tx-this.target.x)*Math.min(1,dt*10);this.target.y+=(ty-this.target.y)*Math.min(1,dt*12);this.target.z+=(tz-this.target.z)*Math.min(1,dt*10);
  const framedPitch=clamp(this.pitch+.18*this.combatFraming,-.12,1.05);
  const direction=new Vector3(-Math.sin(this.yaw)*Math.cos(framedPitch),Math.sin(framedPitch),-Math.cos(this.yaw)*Math.cos(framedPitch));
  let available=wantedDistance;
  // Sweep a padded camera volume through the same obstacle set as gameplay.
  for(let d=.35;d<wantedDistance;d+=.14){const x=this.target.x+direction.x*d,y=this.target.y+direction.y*d,z=this.target.z+direction.z*d;
   if(y<groundHeight(x,z)+.22||obstacles.some(o=>solid(o,sim.save)&&y<groundHeight(o.x,o.z)+o.height+.2&&Math.abs(x-o.x)<o.w/2+.24&&Math.abs(z-o.z)<o.d/2+.24)){available=Math.max(.35,d-.2);break;}}
  this.currentDistance=available<this.currentDistance?available:this.currentDistance+(available-this.currentDistance)*Math.min(1,dt*3);
  this.camera.position.copyFrom(this.target.add(direction.scale(this.currentDistance)));this.camera.setTarget(this.target);
 }
}
