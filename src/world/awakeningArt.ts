import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import type { Geometry, XYZ } from '../assets/geometry';
import { seededRandom } from '../core/math';
import { groundHeight } from './level';

/** Static dressing: low paving follows the walkable floor; tall details hug existing solids. */
export function createAwakeningArt(g:Geometry):void{
  const random=seededRandom(181026);
  // Concentric, individually cut stones leave moss seams and a clear north exit.
  for(const [radius,count,width] of [[2.65,22,.76],[3.65,30,.80]] as const){
    for(let i=0;i<count;i++){
      const angle=i*Math.PI*2/count,half=Math.PI/count*.92,inner=radius-width/2,outer=radius+width/2;
      const positions:number[]=[];
      for(const r of [inner,outer])for(const a of [angle-half,angle,angle+half]){
        const x=Math.sin(a)*r,z=Math.cos(a)*r;positions.push(x,groundHeight(x,z)+.018,z);
      }
      g.surface('awakening-ring-stone',null,positions,[0,1,3,1,4,3,1,2,4,2,5,4],i%4?'#a4ab92':'#8c9380');
    }
  }
  for(const r of [1.05,1.8]){
    const ring=CreateTorus('awakening-engraving',{diameter:r*2,thickness:.016,tessellation:64},g.scene);
    g.place(ring,null,[0,.024,0],[1,1,1],'#727f68');
  }
  g.tube('awakening-sigil',null,[[0,.029,-.85],[-.7,.029,0],[0,.029,.85],[.7,.029,0],[0,.029,-.85]],.02,'#76b7a1',.1);
  // Fern rosettes with feathered fronds, flower patches and grass at the margins.
  const foliage=[{positions:[] as number[],indices:[] as number[]},{positions:[] as number[],indices:[] as number[]}];
  for(let i=0;i<100;i++){
    const side=i%2?1:-1,z=-7+random()*23,x=side*(3.8+random()*5.5),y=groundHeight(x,z);
    if(x*x+z*z<18)continue;
    const scale=.65+random()*.65;
    for(let f=0;f<5;f++){
      const angle=f*Math.PI*2/5+random()*.4,dx=Math.sin(angle),dz=Math.cos(angle);
      const points:XYZ[]=[];
      for(let n=0;n<5;n++){const t=n/4;points.push([x+dx*t*.6*scale,y+Math.sin(t*Math.PI*.8)*.45*scale,z+dz*t*.6*scale]);}
      g.tapered('fern-rachis',null,points,.012,'#577e4d');
      for(let n=1;n<5;n++)for(const leafSide of [-1,1]){
        const t=n/5,len=(1-t)*.20*scale,bx=x+dx*t*.6*scale,bz=z+dz*t*.6*scale,by=y+Math.sin(t*Math.PI*.8)*.45*scale;
        const tx=bx+(dx*.4+dz*leafSide)*len,tz=bz+(dz*.4-dx*leafSide)*len;
        const batch=foliage[n%2]!,first=batch.positions.length/3;
        batch.positions.push(bx,by,bz,tx,by+.045,tz,bx+dx*.09,by+.025,bz+dz*.09);
        batch.indices.push(first,first+1,first+2);
      }
    }
    if(i%3===0)for(let j=0;j<3;j++){
      const fx=x+random()*.4-.2,fz=z+random()*.4-.2,h=.18+random()*.2;
      g.tube('bluebell-stem',null,[[fx,y,fz],[fx+.025,y+h,fz]],.009,'#577e4d');
      for(let p=0;p<5;p++){
        const a=p*Math.PI*.4;
        const petal=g.sphere('ivory-blue-flower',null,[fx+.025+Math.sin(a)*.05,y+h+.015,fz+Math.cos(a)*.05],[.07,.025,.115],j%2?'#d1eaf0':'#a9c6da',.12,4);petal.rotation.y=a;
      }
      g.sphere('flower-heart',null,[fx+.025,y+h+.03,fz],[.035,.03,.035],'#fff0b5',.2,4);
    }
  }
  foliage.forEach((batch,i)=>g.surface('fern-pinnae',null,batch.positions,batch.indices,i?'#6d994e':'#4b7848'));
  // Moss and climbing leaves soften the four existing columns, inside their silhouette.
  for(const x of [-7,7])for(const z of [-5,5]){
    const y=groundHeight(x,z);
    g.tapered('pillar-ivy',null,[[x-.3,y+.08,z-.4],[x+.18,y+.7,z-.37],[x-.15,y+1.4,z-.35],[x+.16,y+2.3,z-.34]],.045,'#577e4d');
    for(let i=0;i<9;i++){
      const leaf=g.leaf('ivy-leaf',null,[x+Math.sin(i*1.8)*.24,y+.2+i*.23,z-.41],.18,.23,i%2?'#6d994e':'#4b7848');leaf.rotation.z=i%2?.9:-.9;
    }
    for(let i=0;i<5;i++)g.sphere('pillar-moss',null,[x+(random()-.5)*.7,y+.13,z+(random()-.5)*.7],[.4,.09,.4],'#6f883e',0,5);
  }
  // Suspended moss on the first arch uses the same masonry and leaves its opening clear.
  for(let i=1;i<10;i++){
    if(i===8)continue;
    const angle=i*Math.PI/10,x=Math.cos(angle)*3.2,y=3.2+Math.sin(angle)*3.2;
    g.sphere('arch-moss-cap',null,[x,y+.37,15],[.85,.20,.85],'#6f883e',0,6);
    if(i%2===0)g.tapered('hanging-arch-vine',null,[[x-.25,y+.25,14.54],[x-.35,y-.15,14.53],[x-.28,y-.6,14.55]],.055,'#577e4d');
  }
}
