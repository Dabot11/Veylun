import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Player, Enemy } from '../core/Simulation';
export interface CharacterRig { root:TransformNode; parts:Record<string,TransformNode>; update(state:Player|Enemy,time:number):void }
export function mergeRigidParts(root:TransformNode,parts:Record<string,TransformNode>):void{
 const groups=new Map<TransformNode,Map<string,Mesh[]>>();
 for(const m of root.getChildMeshes())if(m instanceof Mesh&&m.parent instanceof TransformNode&&!Object.values(parts).includes(m)){const materials=groups.get(m.parent)??new Map<string,Mesh[]>();const key=(m.material?.name??'')+'|'+m.getVerticesDataKinds().sort().join(',');const meshes=materials.get(key)??[];meshes.push(m);materials.set(key,meshes);groups.set(m.parent,materials);}
 for(const[parent,materials]of groups)for(const meshes of materials.values())if(meshes.length>1){parent.computeWorldMatrix(true);const inverse=parent.getWorldMatrix().clone().invert();const merged=Mesh.MergeMeshes(meshes,true,true,undefined,false,true);if(merged){merged.bakeTransformIntoVertices(inverse);merged.parent=parent;merged.isPickable=false;}}
}
