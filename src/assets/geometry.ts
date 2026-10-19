import { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateTube } from '@babylonjs/core/Meshes/Builders/tubeBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { surfaceTexture } from './surfaceTexture';
import type { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
export type XYZ = readonly [number,number,number];
export class Geometry {
  materials=new Map<string,StandardMaterial>();
  textures=new Map<string,DynamicTexture>();
  constructor(readonly scene:Scene){}
  mat(color:string,glow=0,alpha=1):StandardMaterial{
    const key=`${color}-${glow}-${alpha}`;let m=this.materials.get(key);if(m)return m;
    m=new StandardMaterial(key,this.scene);m.diffuseColor=Color3.FromHexString(color);m.specularColor=new Color3(.07,.065,.05);m.emissiveColor=m.diffuseColor.scale(glow);m.alpha=alpha;m.backFaceCulling=false;if(glow===0){
      const kind=['#615439','#6c5b38','#775232','#987243','#775232','#765338'].includes(color)?'bark':['#a4ab92','#a6ac91','#a3aa91','#a8af8c','#939e7e','#adb293','#8c9380','#969782','#b8b49c','#929b85','#959b85'].includes(color)?'stone':['#e4d8b5','#ecdfbf','#d8cfad','#245e58','#263f38'].includes(color)?'cloth':color==='#ffffff'?'ground':null;
      if(kind){let tex=this.textures.get(kind);if(!tex){tex=surfaceTexture(this.scene,kind);this.textures.set(kind,tex);}m.diffuseTexture=tex;}
    }
    this.materials.set(key,m);return m;
  }
  node(name:string,parent?:TransformNode,pos:XYZ=[0,0,0]):TransformNode{const n=new TransformNode(name,this.scene);if(parent)n.parent=parent;n.position.set(...pos);return n;}
  place(m:Mesh,parent:TransformNode|null,pos:XYZ,scale:XYZ,color:string,glow=0):Mesh{m.parent=parent;m.position.set(...pos);m.scaling.set(...scale);m.material=this.mat(color,glow);m.isPickable=false;return m;}
  sphere(name:string,parent:TransformNode|null,pos:XYZ,scale:XYZ,color:string,glow=0,segments=8):Mesh{return this.place(CreateSphere(name,{diameter:1,segments},this.scene),parent,pos,scale,color,glow);}
  box(name:string,parent:TransformNode|null,pos:XYZ,scale:XYZ,color:string,glow=0):Mesh{return this.place(CreateBox(name,{size:1},this.scene),parent,pos,scale,color,glow);}
  cylinder(name:string,parent:TransformNode|null,pos:XYZ,height:number,bottom:number,top:number,color:string,tess=10):Mesh{const m=CreateCylinder(name,{height,diameterBottom:bottom,diameterTop:top,tessellation:tess},this.scene);return this.place(m,parent,pos,[1,1,1],color);}
  tube(name:string,parent:TransformNode|null,points:XYZ[],radius:number,color:string,glow=0):Mesh{const m=CreateTube(name,{path:points.map(p=>new Vector3(...p)),radius,tessellation:6,cap:Mesh.CAP_ALL},this.scene);return this.place(m,parent,[0,0,0],[1,1,1],color,glow);}
  tapered(name:string,parent:TransformNode|null,points:XYZ[],radius:number,color:string):Mesh{
    const m=CreateTube(name,{path:points.map(p=>new Vector3(...p)),radiusFunction:i=>radius*Math.max(.035,Math.sin((.18+.82*i/(points.length-1))*Math.PI)),tessellation:7,cap:Mesh.CAP_ALL},this.scene);
    return this.place(m,parent,[0,0,0],[1,1,1],color);
  }
  surface(name:string,parent:TransformNode|null,positions:number[],indices:number[],color:string):Mesh{
    const m=new Mesh(name,this.scene),v=new VertexData();v.positions=positions;v.indices=indices;v.normals=[];
    const coordinates=[0,1,2].map(axis=>positions.filter((_,i)=>i%3===axis));
    const low=coordinates.map(values=>Math.min(...values)),span=coordinates.map((values,axis)=>Math.max(...values)-low[axis]!);
    const flat=span.indexOf(Math.min(...span)),axes=[0,1,2].filter(axis=>axis!==flat);
    v.uvs=[];for(let i=0;i<positions.length;i+=3)for(const axis of axes)v.uvs.push((positions[i+axis]!-low[axis]!)/Math.max(.00001,span[axis]!));
    VertexData.ComputeNormals(positions,indices,v.normals);v.applyToMesh(m);
    return this.place(m,parent,[0,0,0],[1,1,1],color);
  }
  leaf(name:string,parent:TransformNode|null,pos:XYZ,width:number,length:number,color:string,glow=0):Mesh{
    const m=new Mesh(name,this.scene),v=new VertexData();
    const positions:number[]=[],indices:number[]=[];
    for(let i=0;i<=6;i++){const t=i/6,w=Math.sin(t*Math.PI)*width*.5*(i%2?.9:1);positions.push(-w,t*length,0,0,t*length,Math.sin(t*Math.PI)*width*.22,w,t*length,0);if(i<6){const a=i*3;indices.push(a,a+1,a+3,a+1,a+4,a+3,a+1,a+2,a+4,a+2,a+5,a+4);}}
    v.positions=positions;v.indices=indices;v.normals=[];VertexData.ComputeNormals(v.positions,v.indices,v.normals);v.applyToMesh(m);
    return this.place(m,parent,pos,[1,1,1],color,glow);
  }
  shield(name:string,parent:TransformNode|null,pos:XYZ,width:number,height:number,color:string):Mesh{
    const outline=[[-.45,.4],[0,.55],[.45,.4],[.38,-.1],[0,-.55],[-.38,-.1]];
    const positions=[0,0,.09],indices:number[]=[];
    for(const [x,y]of outline)positions.push(x!*width,y!*height,0);
    for(let i=0;i<6;i++)indices.push(0,1+i,1+(i+1)%6);
    const m=new Mesh(name,this.scene),v=new VertexData();v.positions=positions;v.indices=indices;v.normals=[];VertexData.ComputeNormals(positions,indices,v.normals);v.applyToMesh(m);
    return this.place(m,parent,pos,[1,1,1],color);
  }
  gem(name:string,parent:TransformNode|null,pos:XYZ,size:number,color='#57e6dc'):Mesh{const m=this.sphere(name,parent,pos,[size,size*1.35,size*.55],color,.75,2);m.rotation.z=Math.PI/4;return m;}
}
