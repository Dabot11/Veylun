import { describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Simulation } from '../../src/core/Simulation';
import { createRuen } from '../../src/assets/ruen';
import { Geometry } from '../../src/assets/geometry';
import type { CharacterRig } from '../../src/assets/characterRig';

vi.mock('../../src/assets/surfaceTexture',()=>({surfaceTexture:()=>null}));
function withRig(check:(rig:CharacterRig)=>void):void{
  const engine=new NullEngine(),scene=new Scene(engine);
  try{check(createRuen(new Geometry(scene)));}finally{scene.dispose();engine.dispose();}
}
describe('Ruen articulated visual contract',()=>{
  it('rests above the floor, including the actual blade tip',()=>withRig(rig=>{
    const p=new Simulation().player;rig.update(p,0);
    const tip=Vector3.TransformCoordinates(new Vector3(0,-.78,0),rig.parts['sword']!.computeWorldMatrix(true));
    expect(tip.y).toBeGreaterThan(0);
    for(const side of [-1,1]){
      const sole=Vector3.TransformCoordinates(new Vector3(0,-.3375,0),rig.parts[`knee${side}`]!.computeWorldMatrix(true));
      expect(sole.y).toBeGreaterThanOrEqual(0);expect(sole.y).toBeLessThan(.02);
    }
  }));
  it('raises the shield in front of the torso with its face toward the threat',()=>withRig(rig=>{
    const p=new Simulation().player;p.shield=true;rig.update(p,0);
    const matrix=rig.parts['shield']!.computeWorldMatrix(true);
    const center=Vector3.TransformCoordinates(Vector3.Zero(),matrix);
    const normal=Vector3.TransformNormal(Vector3.Forward(),matrix).normalize();
    // Chest and brooch occupy the first .22 m in front of the origin.
    expect(center.z).toBeGreaterThan(.22);expect(center.y).toBeGreaterThan(.85);expect(normal.z).toBeGreaterThan(.9);
  }));
  it('clears every temporary pose when returning to idle',()=>withRig(rig=>{
    const p=new Simulation().player;rig.update(p,0);
    const pose=()=>[rig.root,...Object.values(rig.parts)].flatMap(n=>[...n.position.asArray(),...n.rotation.asArray()]);
    const idle=pose();
    for(const state of ['jump','land','roll','attack1','hurt','death','interact','victory'] as const){
      Object.assign(p,{state,stateTime:.2,attackTime:state==='attack1'?.25:-1,shield:state==='land'});rig.update(p,.2);
      Object.assign(p,{state:'idle',stateTime:0,attackTime:-1,shield:false});rig.update(p,0);
      pose().forEach((value,i)=>expect(value).toBeCloseTo(idle[i]!));
    }
  }));
  it('flexes knees while moving and settles when movement is blocked',()=>withRig(rig=>{
    const p=new Simulation().player;Object.assign(p,{state:'run',vx:4.8,vz:0});
    rig.update(p,0);rig.update(p,.1);
    expect(rig.parts['knee1']!.rotation.x).toBeGreaterThan(.4);
    const hem=Vector3.TransformCoordinates(new Vector3(0,-.72,-.13),rig.parts['cape']!.computeWorldMatrix(true));
    expect(hem.z).toBeLessThan(-.15); // Cloth trails behind the legs instead of swinging through them.
    p.vx=0;rig.update(p,.2);
    for(const side of [-1,1])expect(rig.parts[`leg${side}`]!.rotation.x).toBe(0);
  }));
});
