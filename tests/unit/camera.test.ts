import { describe,it,expect } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { FollowCamera } from '../../src/camera/FollowCamera';
import { Simulation } from '../../src/core/Simulation';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Viewport } from '@babylonjs/core/Maths/math.viewport';
describe('third person camera',()=>{
 it('follows the player and restores framing after respawn',()=>{
  const engine=new NullEngine(),scene=new Scene(engine);try{const g=new Simulation(),c=new FollowCamera(scene);c.reset(g);const before=c.camera.position.x;g.player.x=3;for(let i=0;i<60;i++)c.update(g,1/60,{x:0,y:0},0);expect(c.camera.position.x).toBeGreaterThan(before+2.9);g.respawn();c.reset(g);expect(c.camera.position.x).toBeCloseTo(0);}finally{scene.dispose();engine.dispose();}
 });
 it('approaches a closed gate and gradually recovers distance when it opens',()=>{
  const engine=new NullEngine(),scene=new Scene(engine);try{const g=new Simulation(),c=new FollowCamera(scene);g.player.z=94;g.player.y=.6;c.reset(g);const blocked=c.camera.position.z;expect(blocked).toBeGreaterThan(90.5);g.save.doorUnlocked=true;for(let i=0;i<120;i++)c.update(g,1/60,{x:0,y:0},0);expect(c.camera.position.z).toBeLessThan(blocked-1);}finally{scene.dispose();engine.dispose();}
 });
 it('lets manual orbit finish before smoothly recentering on the target',()=>{
  const engine=new NullEngine(),scene=new Scene(engine);
  try{
   const g=new Simulation(),c=new FollowCamera(scene);g.player.x=-2;g.player.z=24;g.targetId='sprout-1';c.reset(g);
   c.update(g,1/60,{x:.6,y:0},0);expect(c.yaw).toBeCloseTo(.6);
   for(let i=0;i<30;i++)c.update(g,1/60,{x:0,y:0},0);
   expect(c.yaw).toBeCloseTo(.6);
   for(let i=0;i<120;i++)c.update(g,1/60,{x:0,y:0},0);
   expect(c.yaw).toBeLessThan(.01);
  }finally{scene.dispose();engine.dispose();}
 });
 it('keeps Ruen and a distant locked enemy inside the viewport',()=>{
  const engine=new NullEngine({renderWidth:800,renderHeight:600,textureSize:512,deterministicLockstep:false,lockstepMaxSteps:4}),scene=new Scene(engine);
  try{
   const g=new Simulation(),c=new FollowCamera(scene);g.player.x=0;g.player.z=18;
   Object.assign(g.enemies[0]!,{x:0,z:31});g.targetId='sprout-1';c.reset(g);
   for(let i=0;i<180;i++)c.update(g,1/60,{x:0,y:0},0);
   const viewport=new Viewport(0,0,800,600);
   const transform=c.camera.getViewMatrix(true).multiply(c.camera.getProjectionMatrix(true));
   for(const actor of [g.player,g.target!]){
    const projected=Vector3.Project(new Vector3(actor.x,actor.y+.5,actor.z),Matrix.Identity(),transform,viewport);
    expect(projected.x).toBeGreaterThan(40);expect(projected.x).toBeLessThan(760);
    expect(projected.y).toBeGreaterThan(30);expect(projected.y).toBeLessThan(570);
    expect(projected.z).toBeGreaterThan(0);expect(projected.z).toBeLessThan(1);
   }
  }finally{scene.dispose();engine.dispose();}
 });
 it.each([[800,600],[390,844]])('keeps nearby combat within a %i × %i viewport', (width,height)=>{
  const engine=new NullEngine({renderWidth:width,renderHeight:height,textureSize:512,deterministicLockstep:false,lockstepMaxSteps:4}),scene=new Scene(engine);
  try{
   const g=new Simulation(),c=new FollowCamera(scene);g.player.x=-2;g.player.z=26;
   Object.assign(g.enemies[0]!,{x:-2,z:27.1});g.targetId='sprout-1';c.reset(g);
   for(let i=0;i<120;i++)c.update(g,1/60,{x:0,y:0},0);
   const transform=c.camera.getViewMatrix(true).multiply(c.camera.getProjectionMatrix(true));
   for(const actor of [g.player,g.target!])for(const side of [-.5,.5]){
    const point=Vector3.Project(new Vector3(actor.x+side,actor.y+.5,actor.z),Matrix.Identity(),transform,new Viewport(0,0,width,height));
    expect(point.x).toBeGreaterThan(10);expect(point.x).toBeLessThan(width-10);
    expect(point.y).toBeGreaterThan(20);expect(point.y).toBeLessThan(height-20);
   }
  }finally{scene.dispose();engine.dispose();}
 });
});
