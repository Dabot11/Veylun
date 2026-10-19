import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { Simulation } from '../core/Simulation';
import { obstacles, solid, groundHeight } from '../world/level';
import { angleDelta, angleTo, clamp } from '../core/math';
export class FollowCamera {
 readonly camera:FreeCamera;yaw=0;pitch=.28;distance=5.8;sensitivity=1;invert=false;
 private currentDistance=5.8;private target=new Vector3();
 constructor(scene:Scene){this.camera=new FreeCamera('follow-camera',new Vector3(0,3,-6),scene);this.camera.minZ=.08;this.camera.maxZ=90;this.camera.fov=.9;this.camera.inputs.clear();}
 reset(sim:Simulation):void{this.yaw=0;this.pitch=.28;this.target.set(sim.player.x,sim.player.y+1,sim.player.z);this.currentDistance=this.distance;this.update(sim,1,{x:0,y:0},0);}
 update(sim:Simulation,dt:number,look:{x:number;y:number},zoom:number):void{
  const p=sim.player;this.yaw+=look.x;this.pitch=clamp(this.pitch+look.y,-.12,1.05);this.distance=clamp(this.distance+zoom*.003,3,8);
  let tx=p.x,ty=p.y+1,tz=p.z;
  if(sim.target){const e=sim.target;this.yaw+=angleDelta(this.yaw,angleTo(p,e))*Math.min(1,dt*3);tx=p.x*.7+e.x*.3;tz=p.z*.7+e.z*.3;ty=p.y+1.1;}
  this.target.x+=(tx-this.target.x)*Math.min(1,dt*10);this.target.y+=(ty-this.target.y)*Math.min(1,dt*12);this.target.z+=(tz-this.target.z)*Math.min(1,dt*10);
  const direction=new Vector3(-Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),-Math.cos(this.yaw)*Math.cos(this.pitch));
  let available=this.distance;
  // Sweep a padded camera volume through the same obstacle set as gameplay.
  for(let d=.35;d<this.distance;d+=.14){const x=this.target.x+direction.x*d,y=this.target.y+direction.y*d,z=this.target.z+direction.z*d;
   if(y<groundHeight(x,z)+.22||obstacles.some(o=>solid(o,sim.save)&&y<groundHeight(o.x,o.z)+o.height+.2&&Math.abs(x-o.x)<o.w/2+.24&&Math.abs(z-o.z)<o.d/2+.24)){available=Math.max(.35,d-.2);break;}}
  this.currentDistance=available<this.currentDistance?available:this.currentDistance+(available-this.currentDistance)*Math.min(1,dt*3);
  this.camera.position.copyFrom(this.target.add(direction.scale(this.currentDistance)));this.camera.setTarget(this.target);
 }
}
