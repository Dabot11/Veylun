import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import type { Scene } from '@babylonjs/core/scene';
import { seededRandom } from '../core/math';
/** Original procedural pigment/grain textures; no external images are used. */
export function surfaceTexture(scene:Scene,kind:'bark'|'stone'|'cloth'|'ground'):DynamicTexture{
 const tex=new DynamicTexture(`original-${kind}`,{width:128,height:128},scene,false);
 const ctx=tex.getContext() as CanvasRenderingContext2D,rng=seededRandom(kind.length*123);const data=ctx.createImageData(128,128);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  let shade=205+rng()*40;
  if(kind==='bark')shade=160+25*Math.sin(x*.48+Math.sin(y*.08)*2)+rng()*36;
  if(kind==='cloth')shade=218+(x%3===0||y%3===0?-20:12)+rng()*14;
  if(kind==='ground')shade=190+rng()*58;
  const i=(y*128+x)*4;data.data[i]=data.data[i+1]=data.data[i+2]=shade;data.data[i+3]=255;
 }
 ctx.putImageData(data,0,0);
 if(kind==='bark'){
  for(let i=0;i<20;i++){ctx.strokeStyle=i%2?'#756b55':'#d2c8ae';ctx.lineWidth=i%3===0?2:1;const x=rng()*128;ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x+8,30,x-6,90,x+4,128);ctx.stroke();}
 }else if(kind==='stone'){
  for(let i=0;i<12;i++){ctx.strokeStyle='#9a9c8b';ctx.lineWidth=.6;let x=rng()*128,y=rng()*128;ctx.beginPath();ctx.moveTo(x,y);for(let j=0;j<4;j++){x+=rng()*12-6;y+=rng()*10;ctx.lineTo(x,y);}ctx.stroke();}
 }
 tex.update();return tex;
}
