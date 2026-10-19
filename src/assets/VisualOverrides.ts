import type { Scene } from '@babylonjs/core/scene';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import type { CharacterRig } from './characters';
import { characterAssets, type CharacterId, type AnimationId } from './assetCatalog';
import type { Simulation } from '../core/Simulation';
/** Optional GLB visuals replace generated meshes while the simulation stays unchanged. */
export class VisualOverrides {
 private entries:{clips:Partial<Record<AnimationId,AnimationGroup>>;enemyIndex:number;current:AnimationGroup|undefined}[]=[];
 async load(scene:Scene,hero:CharacterRig,enemies:CharacterRig[]):Promise<void>{
  const ids:CharacterId[]=['ruen','corrupt-sprout','corrupt-sprout','wandering-spirit','ancestral-guardian'];
  for(const[i,rig]of [hero,...enemies].entries()){
   const asset=characterAssets[ids[i]!];if(!asset.modelPath)continue;
   const procedural=rig.root.getChildren();
   try{
    const {loadCharacterModel}=await import('./ModelLoader');const model=await loadCharacterModel(asset,scene);
    model.root.parent=rig.root;for(const n of procedural)n.setEnabled(false);
    this.entries.push({clips:model.animations,enemyIndex:i-1,current:undefined});
    scene.onDisposeObservable.addOnce(()=>model.dispose());
   }catch(error){console.warn(`No se pudo cargar ${asset.id}; se conserva el modelo provisional.`,error);}
  }
 }
 update(sim:Simulation):void{
  for(const e of this.entries){let state:AnimationId;
   if(e.enemyIndex<0)state=sim.player.state;
   else{const enemy=sim.enemies[e.enemyIndex]!;state=enemy.hp<=0?'death':enemy.hurt>0?'hurt':enemy.state==='attack'?(enemy.attackIndex%2?'attack2':'attack1'):enemy.state==='chase'||enemy.state==='patrol'?'walk':'idle';}
   const next=e.clips[state]??e.clips.idle;if(next===e.current)continue;e.current?.stop();e.current=next;
   next?.start(['idle','walk','run','shield','fall'].includes(state));
  }
 }
}
