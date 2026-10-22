import './inspector.css';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { RawCubeTexture } from '@babylonjs/core/Materials/Textures/rawCubeTexture';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import '@babylonjs/core/Culling/ray';
import { assetUrl } from '../assets/assetCatalog';
import { loadInspectionModel, type InspectionModel } from '../assets/inspectModel';

const masterPath='assets/models/ruen/Meshy_AI_Crimson_Gemwarden_All_Animations.glb';
const motionWarnings:Record<string,string>={
 Attack:'Secuencia completa de 2.8 s según la inspección aportada; sin eventos de daño.',
 Weapon_Combo:'Secuencia completa; desplazamiento Z reportado de 1.23 unidades. Sólo inspección, sin collider.',
 Weapon_Combo_1:'Secuencia completa; desplazamiento Z reportado de 2.08 unidades. No equivale al golpe 2 del combo.',
 Weapon_Combo_2:'Secuencia completa; desplazamiento Z reportado de 0.99 unidades. No equivale al golpe 3 del combo.',
 Back_Jump:'Retroceso reportado de 1.99 unidades. No se utiliza como salto manual ni esquiva.',
 Combat_Stance:'Postura de combate; no validada como idle neutro ni bloqueo.',
 Axe_Breathe_and_Look_Around:'Animación de hacha; no validada como idle neutro.',
};

/** Independent art test bench. It has no gameplay controller, save access or damage events. */
export class AssetInspector {
 readonly engine:Engine;
 readonly scene:Scene;
 readonly camera:ArcRotateCamera;
 model:InspectionModel|undefined;
 private panel:HTMLElement;
 private disposed=false;
 private view:'front'|'side'|'back'='front';
 private file:HTMLInputElement;
 private loadButton:HTMLButtonElement;
 private controls:HTMLFieldSetElement;
 private clips:HTMLSelectElement;
 private play:HTMLButtonElement;
 private speed:HTMLInputElement;
 private status:HTMLElement;
 private playback:HTMLElement;
 private report:HTMLElement;
 private warning:HTMLElement;
 private scale:HTMLInputElement;
 private yaw:HTMLInputElement;

 constructor(readonly canvas:HTMLCanvasElement){
  document.body.dataset['mode']='asset-inspector';
  canvas.setAttribute('aria-label','Visor de inspección del modelo 3D');
  this.engine=new Engine(canvas,true,{stencil:true});
  this.engine.setHardwareScalingLevel(1/Math.min(devicePixelRatio||1,1.5));
  this.scene=new Scene(this.engine);
  this.scene.clearColor=new Color4(.065,.085,.10,1);
  this.camera=new ArcRotateCamera('asset-camera',Math.PI/2,Math.PI/2,3.6,new Vector3(0,.85,0),this.scene);
  this.camera.minZ=.01;this.camera.maxZ=300;
  this.camera.lowerRadiusLimit=.3;this.camera.upperRadiusLimit=50;
  this.camera.lowerBetaLimit=.05;this.camera.upperBetaLimit=Math.PI-.05;
  this.camera.wheelDeltaPercentage=.01;
  this.camera.attachControl(canvas,true);
  const sky=new HemisphericLight('inspection-sky',Vector3.Up(),this.scene);
  sky.intensity=.85;sky.groundColor=new Color3(.25,.26,.28);
  const key=new DirectionalLight('inspection-key',new Vector3(-.5,-1,-.6),this.scene);key.intensity=2;
  const fill=new DirectionalLight('inspection-fill',new Vector3(.5,-.3,.7),this.scene);fill.intensity=.8;
  // Local neutral reflection source for PBR metals; no remote environment dependency.
  this.scene.environmentTexture=new RawCubeTexture(this.scene,Array.from({length:6},()=>new Uint8Array([160,170,180,255])),1,Engine.TEXTUREFORMAT_RGBA);
  this.scene.environmentIntensity=.45;
  const ground=CreateGround('inspection-floor',{width:16,height:16},this.scene);
  const material=new StandardMaterial('inspection-floor-material',this.scene);
  material.diffuseColor=new Color3(.11,.14,.16);material.specularColor=Color3.Black();ground.material=material;
  for(let i=-8;i<=8;i++){
   const t=i*.5;
   const x=CreateLines(`inspection-grid-x-${i}`,{points:[new Vector3(t,.002,-4),new Vector3(t,.002,4)]},this.scene);
   const z=CreateLines(`inspection-grid-z-${i}`,{points:[new Vector3(-4,.002,t),new Vector3(4,.002,t)]},this.scene);
   x.color=z.color=new Color3(.21,.25,.27);
  }
  const axis=CreateLines('inspection-positive-z',{points:[new Vector3(0,.006,0),new Vector3(0,.006,1),new Vector3(-.08,.006,.85),new Vector3(0,.006,1),new Vector3(.08,.006,.85)]},this.scene);
  axis.color=new Color3(.4,.85,.8);
  this.panel=document.createElement('aside');this.panel.id='asset-inspector';
  this.panel.innerHTML=`
   <a class="inspector-back" href="${import.meta.env.BASE_URL}">← Volver al MVP</a>
   <p class="inspector-kicker">VEYLUN · PRUEBA DE ASSET</p>
   <h1>Ruen / Meshy</h1>
   <p class="inspector-intro">Carga el GLB original para revisar materiales, esqueleto y un clip a la vez.</p>
   <label class="inspector-file">Abrir GLB desde tu equipo<input id="asset-file" type="file" accept=".glb,model/gltf-binary"></label>
   <button id="asset-load-default" type="button">Cargar desde el repositorio</button>
   <p id="asset-status" role="status">Sin modelo cargado. El archivo local se lee en este navegador.</p>
   <fieldset id="asset-controls" disabled>
    <legend>Animación</legend>
    <label>Clip<select id="asset-clip"><option>Sin clips</option></select></label>
    <div class="inspector-row"><button id="asset-play" type="button">Reproducir</button><button id="asset-restart" type="button">Reiniciar clip</button></div>
    <label>Velocidad <output id="asset-speed-label">1×</output><input id="asset-speed" type="range" min="0.1" max="2" step="0.05" value="1"></label>
    <p id="asset-playback" aria-live="polite">Sin animación</p>
    <p id="asset-clip-warning"></p>
    <div class="inspector-row" aria-label="Vistas del modelo"><button id="asset-view-front" type="button">Frontal</button><button id="asset-view-side" type="button">Lateral</button><button id="asset-view-back" type="button">Trasera</button></div>
    <p class="inspector-hint">Arrastra para orbitar. Rueda para acercar. Cuadrícula: 0.5 unidades; flecha: +Z.</p>
    <details><summary>Escala y orientación exteriores</summary>
     <label>Escala uniforme<input id="asset-scale" type="number" min="0.05" max="10" step="0.01" value="1"></label>
     <label>Orientación Y (grados)<input id="asset-yaw" type="number" min="-180" max="180" step="90" value="0"></label>
     <p>Frontal toma +Z como referencia. Confirma el frente real del modelo. Los ajustes no modifican huesos ni el archivo.</p>
    </details>
   </fieldset>
   <details><summary>Inventario real del archivo</summary><pre id="asset-report">Sin datos: aún no se ha cargado un GLB.</pre><button id="asset-export" disabled type="button">Descargar informe JSON</button></details>
   <details><summary>Revisión visual pendiente</summary><p>Walking y Running: revisar manos, hombros, rodillas, capa desde atrás, orientación y contacto de pies. No hay Idle neutro, Block, Roll/Dodge ni salto normal identificados en la inspección aportada. Los clips de armas requieren revisar coreografía y root motion.</p></details>
   <p class="inspector-note">Modo aislado. Ningún clip está conectado al gameplay. El MVP conserva su representación provisional y sus animaciones actuales.</p>`;
  document.querySelector('#app')!.append(this.panel);
  this.file=this.element<HTMLInputElement>('asset-file');
  this.loadButton=this.element<HTMLButtonElement>('asset-load-default');
  this.controls=this.element<HTMLFieldSetElement>('asset-controls');
  this.clips=this.element<HTMLSelectElement>('asset-clip');
  this.play=this.element<HTMLButtonElement>('asset-play');
  this.speed=this.element<HTMLInputElement>('asset-speed');
  this.status=this.element('asset-status');this.playback=this.element('asset-playback');
  this.report=this.element('asset-report');this.warning=this.element('asset-clip-warning');
  this.scale=this.element<HTMLInputElement>('asset-scale');this.yaw=this.element<HTMLInputElement>('asset-yaw');
  this.file.onchange=()=>{const file=this.file.files?.[0];if(file)void this.load(file);};
  this.loadButton.onclick=()=>void this.load(assetUrl(masterPath));
  this.clips.onchange=()=>{this.model?.player.select(this.clips.value);this.updatePlayback();};
  this.play.onclick=()=>{const player=this.model?.player;if(!player)return;if(player.isPlaying)player.pause();else player.play();this.updatePlayback();};
  this.element('asset-restart').onclick=()=>{this.model?.player.select(this.clips.value);this.updatePlayback();};
  this.speed.oninput=()=>{this.model?.player.setSpeed(Number(this.speed.value));this.element('asset-speed-label').textContent=`${this.speed.value}×`;};
  for(const view of ['front','side','back'] as const)this.element(`asset-view-${view}`).onclick=()=>{this.view=view;this.setView();};
  this.scale.onchange=()=>{
   const value=Number(this.scale.value);
   if(!this.model||!Number.isFinite(value)||value<.05||value>10){this.scale.value=String(this.model?.root.scaling.x??1);return;}
   this.model.root.scaling.setAll(value);this.frameModel();
  };
  this.yaw.onchange=()=>{
   const value=Number(this.yaw.value);
   if(!this.model||!Number.isFinite(value)||Math.abs(value)>180){this.yaw.value=String((this.model?.root.rotation.y??0)*180/Math.PI);return;}
   this.model.root.rotation.y=value*Math.PI/180;this.setView();
  };
  this.element('asset-export').onclick=()=>{
   const url=URL.createObjectURL(new Blob([this.report.textContent??''],{type:'application/json'}));
   const link=document.createElement('a');link.href=url;link.download='ruen-inspection.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  window.addEventListener('resize',this.resize);document.addEventListener('visibilitychange',this.visibility);
  document.body.dataset['engine']='ready';
  if(import.meta.env.DEV&&new URLSearchParams(location.search).has('test'))Object.assign(window,{__assetInspector:this});
 }

 private element<T extends HTMLElement=HTMLElement>(id:string):T{return this.panel.querySelector<T>(`#${id}`)!;}
 private async load(source:File|string):Promise<void>{
  if(this.file.disabled||this.disposed)return;
  this.file.disabled=this.loadButton.disabled=true;this.controls.disabled=true;
  this.element<HTMLButtonElement>('asset-export').disabled=true;
  this.model?.dispose();this.model=undefined;
  this.clips.replaceChildren(new Option('Sin clips',''));this.report.textContent='Sin datos: carga en curso.';
  this.playback.textContent='Sin animación';this.warning.textContent='';
  this.status.textContent='Cargando geometría, materiales y animaciones…';this.status.dataset['state']='loading';
  try{
   if(source instanceof File&&!source.name.toLowerCase().endsWith('.glb'))throw new Error('Selecciona un archivo .glb.');
   const model=await loadInspectionModel(source,this.scene);
   if(this.disposed){model.dispose();return;}
   this.model=model;this.scale.value='1';this.yaw.value='0';this.speed.value='1';this.element('asset-speed-label').textContent='1×';
   this.report.textContent=JSON.stringify({source:source instanceof File?{name:source.name,bytes:source.size}:{path:masterPath},...model.report},null,2);
   this.clips.replaceChildren(...model.report.animationGroups.map(clip=>new Option(`${clip.name} · ${clip.durationSeconds.toFixed(3)} s`,clip.name)));
   const first=model.report.animationGroups.find(c=>c.name==='Walking')??model.report.animationGroups[0];
   if(first){this.clips.value=first.name;model.player.select(first.name);model.player.pause();}
   this.controls.disabled=false;this.clips.disabled=this.play.disabled=this.element<HTMLButtonElement>('asset-restart').disabled=!first;
   this.element<HTMLButtonElement>('asset-export').disabled=false;
   this.frameModel();this.updatePlayback();
   this.status.textContent=`Carga completada: ${model.report.animationGroups.length} clips. Reproducción pausada; sin integración al gameplay.`;
   this.status.dataset['state']='loaded';
  }catch(error){
   if(this.disposed)return;
   this.model?.dispose();this.model=undefined;
   const message=error instanceof Error?error.message:String(error);
   this.status.textContent=`No se pudo cargar el GLB. Abre el archivo local o colócalo en public/${masterPath}. ${message}`;
   this.status.dataset['state']='error';this.report.textContent='Sin datos: el archivo no se ha cargado.';
   console.error('Inspección GLB: carga fallida.',error);
  }finally{if(!this.disposed){this.file.value='';this.file.disabled=this.loadButton.disabled=false;}}
 }
 private frameModel():void{
  if(!this.model)return;
  const bounds=this.model.root.getHierarchyBoundingVectors(true);
  if(Number.isFinite(bounds.min.y)&&Number.isFinite(bounds.max.y)){
   this.camera.setTarget(bounds.min.add(bounds.max).scale(.5));
   this.camera.radius=Math.max(1,bounds.max.subtract(bounds.min).length()*1.5);
  }
  this.setView();
 }
 private setView():void{
  this.camera.alpha=({front:Math.PI/2,side:0,back:-Math.PI/2}[this.view])-(this.model?.root.rotation.y??0);
  this.camera.beta=Math.PI/2;
  this.camera.inertialAlphaOffset=this.camera.inertialBetaOffset=this.camera.inertialRadiusOffset=0;
 }
 private updatePlayback():void{
  const player=this.model?.player;if(!player)return;
  this.play.textContent=player.isPlaying?'Pausar':'Reproducir';
  this.playback.textContent=player.currentName?`${player.currentName} · ${player.isPlaying?'Reproduciendo':'Pausado'}`:'El archivo no contiene clips.';
  this.warning.textContent=motionWarnings[player.currentName??'']??(player.currentName==='Walking'||player.currentName==='Running'?'Prueba de locomoción en el visor. El avance del juego seguirá perteneciendo al controlador.':'Sólo inspección. Sin asignación automática a estados del juego.');
 }
 private resize=():void=>this.engine.resize();
 private visibility=():void=>{if(document.hidden){this.model?.player.pause();this.updatePlayback();}};
 start():void{this.engine.runRenderLoop(()=>{if(!document.hidden)this.scene.render();});}
 dispose():void{
  this.disposed=true;window.removeEventListener('resize',this.resize);document.removeEventListener('visibilitychange',this.visibility);
  this.engine.stopRenderLoop();this.model?.dispose();this.scene.dispose();this.engine.dispose();this.panel.remove();
  delete document.body.dataset['mode'];
  if(import.meta.env.DEV)delete (window as Window&{__assetInspector?:AssetInspector}).__assetInspector;
 }
}
