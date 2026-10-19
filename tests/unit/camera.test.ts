import { describe,it,expect } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { FollowCamera } from '../../src/camera/FollowCamera';
import { Simulation } from '../../src/core/Simulation';
describe('third person camera',()=>{
 it('follows the player and restores framing after respawn',()=>{
  const engine=new NullEngine(),scene=new Scene(engine);try{const g=new Simulation(),c=new FollowCamera(scene);c.reset(g);const before=c.camera.position.x;g.player.x=3;for(let i=0;i<60;i++)c.update(g,1/60,{x:0,y:0},0);expect(c.camera.position.x).toBeGreaterThan(before+2.9);g.respawn();c.reset(g);expect(c.camera.position.x).toBeCloseTo(0);}finally{scene.dispose();engine.dispose();}
 });
 it('approaches a closed gate and gradually recovers distance when it opens',()=>{
  const engine=new NullEngine(),scene=new Scene(engine);try{const g=new Simulation(),c=new FollowCamera(scene);g.player.z=94;g.player.y=.6;c.reset(g);const blocked=c.camera.position.z;expect(blocked).toBeGreaterThan(90.5);g.save.doorUnlocked=true;for(let i=0;i<120;i++)c.update(g,1/60,{x:0,y:0},0);expect(c.camera.position.z).toBeLessThan(blocked-1);}finally{scene.dispose();engine.dispose();}
 });
});
