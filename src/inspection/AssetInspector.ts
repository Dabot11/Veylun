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
import type { RuenEquipmentPreview } from '../assets/RuenEquipmentPreview';
import { ruenRuntimeEquipmentProfiles } from '../assets/ruenEquipmentProfile';

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
 equipment:RuenEquipmentPreview|undefined;
 private panel:HTMLElement;
 private disposed=false;
 private started=false;
 private readonly combatPreviewRequested=new URLSearchParams(location.search).get('motion')==='combat-v1';
 private readonly idlePreviewRequested=this.combatPreviewRequested||new URLSearchParams(location.search).get('motion')==='idle-v1';
 private readonly equipmentRequested=this.combatPreviewRequested||(this.idlePreviewRequested&&new URLSearchParams(location.search).get('equipment')==='azure');
 private idlePreviewName:string|undefined;
 private equippedIdleName:string|undefined;
 private combatOptions:{name:string;label:string;duration:number}[]=[];
 private reportData:Record<string,unknown>={};
 private idlePreviewError='';
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
   <h1>${this.combatPreviewRequested?'Ruen / Defensa y ataques':this.equipmentRequested?'Ruen / Idle con equipo':this.idlePreviewRequested?'Ruen / Idle · prototipo v1':'Ruen / Meshy'}</h1>
   <p class="inspector-intro">El modelo original se carga automáticamente. Revisa sus materiales, esqueleto y un clip a la vez.</p>
   ${this.combatPreviewRequested?'<p class="inspector-note">Guardia, reacción al bloqueo y tres golpes de espada. Elige un clip y reduce la velocidad para revisar sus poses. Las animaciones se repiten aquí para facilitar la comparación.</p>':this.idlePreviewRequested?'<p class="inspector-note">Respiración suave en un ciclo de 4 segundos. El juego incorpora esta base de Idle con espada y escudo; aquí puedes revisar los modelos originales.</p>':''}
   <label class="inspector-file">Abrir GLB desde tu equipo<input id="asset-file" type="file" accept=".glb,model/gltf-binary"></label>
   <button id="asset-load-default" type="button">Recargar modelo original</button>
   <p id="asset-status" role="status">Preparando la carga del modelo…</p>
   <fieldset id="asset-controls" disabled>
    <legend>Animación</legend>
    ${this.equipmentRequested?`<label class="inspector-equipment"><input id="asset-equipment-toggle" type="checkbox" disabled>Espada y escudo${this.combatPreviewRequested?'':' (Idle)'}</label><p id="asset-equipment-status" role="status" data-state="idle">Preparando equipo…</p><button id="asset-equipment-retry" type="button" hidden>Reintentar carga del equipo</button>`:''}
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
   <p class="inspector-note">Visor aislado: reproduce un solo clip. El juego usa a Ruen con su equipo para reposo, movimiento, defensa y ataques. Salto, esquiva y las demás acciones conservan el modelo provisional mientras se adaptan sus animaciones.</p>
   <a class="inspector-back" href="${import.meta.env.BASE_URL}">Jugar con Ruen →</a>`;
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
  if(this.equipmentRequested){
   this.element<HTMLInputElement>('asset-equipment-toggle').onchange=()=>this.toggleEquipment();
   this.element('asset-equipment-retry').onclick=()=>void this.loadEquipment();
  }
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
  this.equipment?.dispose();this.equipment=undefined;this.model?.dispose();this.model=undefined;
  this.idlePreviewName=undefined;this.idlePreviewError='';
  this.equippedIdleName=undefined;this.combatOptions=[];this.reportData={};
  if(this.equipmentRequested){this.element<HTMLInputElement>('asset-equipment-toggle').disabled=true;this.element<HTMLInputElement>('asset-equipment-toggle').checked=false;this.element('asset-equipment-status').textContent='Preparando equipo…';this.element('asset-equipment-status').dataset['state']='idle';this.element('asset-equipment-retry').hidden=true;}
  this.clips.replaceChildren(new Option('Sin clips',''));this.report.textContent='Sin datos: carga en curso.';
  this.playback.textContent='Sin animación';this.warning.textContent='';
  this.status.textContent='Cargando geometría, materiales y animaciones…';this.status.dataset['state']='loading';
  try{
   if(source instanceof File&&!source.name.toLowerCase().endsWith('.glb'))throw new Error('Selecciona un archivo .glb.');
   const model=await loadInspectionModel(source,this.scene);
   if(this.disposed){model.dispose();return;}
   this.model=model;this.scale.value='1';this.yaw.value='0';this.speed.value='1';this.element('asset-speed-label').textContent='1×';
   let authoredPreview:Record<string,unknown>|undefined;
   if(this.combatPreviewRequested){
    try{
     const {createRuenEquippedLocomotion}=await import('../assets/ruenEquippedLocomotion');
     const {createRuenEquippedCombat}=await import('../assets/ruenEquippedCombat');
     const {createRuenIdlePreview}=await import('../assets/ruenIdlePreview');
     if(this.disposed){model.dispose();return;}
     const locomotion=createRuenEquippedLocomotion(model,this.scene);
     model.container.animationGroups.push(...Object.values(locomotion));
     const combat=createRuenEquippedCombat(model,this.scene,locomotion);
     model.container.animationGroups.push(...Object.values(combat));
     const neutral=createRuenIdlePreview(model,this.scene);
     model.container.animationGroups.push(neutral);
     this.idlePreviewName=neutral.name;this.equippedIdleName=locomotion.idle.name;
     const labels:Record<string,string>={walk:'Caminar',run:'Correr',shield:'Guardia',block:'Bloqueo recibido',attack1:'Ataque 1 · corte diagonal',attack2:'Ataque 2 · revés',attack3:'Ataque 3 · golpe alto'};
     this.combatOptions=Object.entries({...locomotion,...combat}).filter(([kind])=>kind!=='idle').map(([kind,group])=>({name:group.name,label:labels[kind]??kind,duration:(group.to-group.from)/group.targetedAnimations[0]!.animation.framePerSecond}));
     authoredPreview={author:'Veylun',stage:'combat-v1',notInMaster:true,gameplayIntegrated:true,clips:[locomotion.idle.name,...this.combatOptions.map(clip=>clip.name)]};
    }catch(error){
     this.idlePreviewError=error instanceof Error?error.message:String(error);
     console.warn('Animaciones de combate no disponibles para este modelo.',error);
    }
   }else if(this.idlePreviewRequested){
    try{
     const {createRuenIdlePreview}=await import('../assets/ruenIdlePreview');
     if(this.disposed){model.dispose();return;}
     const idle=createRuenIdlePreview(model,this.scene);
     // Keep the immutable file inventory separate from this authored preview.
     // The player's shared group list also owns stop/reset/disposal of the new clip.
     model.container.animationGroups.push(idle);this.idlePreviewName=idle.name;
     authoredPreview={name:idle.name,author:'Veylun',stage:'prototype-v1',durationSeconds:4,notInMaster:true,gameplayIntegrated:false};
     if(this.equipmentRequested){
      const {createRuenEquippedIdlePreview}=await import('../assets/ruenEquippedIdlePreview');
      if(this.disposed)return;
      const armed=createRuenEquippedIdlePreview(model,this.scene,idle);
      model.container.animationGroups.push(armed);this.equippedIdleName=armed.name;
     }
    }catch(error){
     this.idlePreviewError=this.idlePreviewName?'':error instanceof Error?error.message:String(error);
     console.warn('Prototipo de Idle no disponible para este modelo.',error);
    }
   }
   this.reportData={source:source instanceof File?{name:source.name,bytes:source.size}:{path:masterPath},...model.report,...(authoredPreview?{authoredPreview}:{})};
   this.refreshReport();
   this.clips.replaceChildren(...model.report.animationGroups.map(clip=>new Option(`${clip.name} · ${clip.durationSeconds.toFixed(3)} s`,clip.name)));
   if(this.idlePreviewName)this.clips.add(new Option('Idle neutro · prototipo v1 · 4.000 s',this.idlePreviewName),0);
   const first=this.idlePreviewName?{name:this.idlePreviewName}:model.report.animationGroups.find(c=>c.name==='Walking')??model.report.animationGroups[0];
   if(first){this.clips.value=first.name;model.player.select(first.name);model.player.pause();}
   if(this.equipmentRequested){
    if(this.equippedIdleName)await this.loadEquipment();
    else{this.element('asset-equipment-status').textContent='Este modelo no es compatible con la pose equipada de Ruen.';this.element('asset-equipment-status').dataset['state']='error';}
    if(this.disposed)return;
   }
   this.controls.disabled=false;this.clips.disabled=this.play.disabled=this.element<HTMLButtonElement>('asset-restart').disabled=!first;
   this.element<HTMLButtonElement>('asset-export').disabled=false;
   this.frameModel();this.updatePlayback();
   this.status.textContent=`Carga completada: ${model.report.animationGroups.length} clips originales${this.combatOptions.length?' + animaciones propias de combate y movimiento':this.idlePreviewName?' + Idle propio de prueba':''}. Reproducción pausada en este visor.${this.idlePreviewError?' Animación propia no disponible para este modelo.':''}`;
   this.status.dataset['state']='loaded';
  }catch(error){
   if(this.disposed)return;
   this.disposeEquipment();this.model?.dispose();this.model=undefined;
   const message=error instanceof Error?error.message:String(error);
   this.status.textContent=`No se pudo cargar el modelo. Pulsa «Recargar modelo original» para reintentar o abre un GLB desde tu equipo. ${message}`;
   this.status.dataset['state']='error';this.report.textContent='Sin datos: el archivo no se ha cargado.';
   console.error('Inspección GLB: carga fallida.',error);
  }finally{if(!this.disposed){this.file.value='';this.file.disabled=this.loadButton.disabled=false;}}
 }
 private disposeEquipment():void{this.equipment?.dispose();this.equipment=undefined;}
 private async loadEquipment():Promise<void>{
  const model=this.model;
  if(!model||!this.equippedIdleName||this.disposed)return;
  const status=this.element('asset-equipment-status'),retry=this.element<HTMLButtonElement>('asset-equipment-retry');
  const toggle=this.element<HTMLInputElement>('asset-equipment-toggle');
  this.controls.disabled=true;this.file.disabled=this.loadButton.disabled=true;
  toggle.disabled=true;toggle.checked=false;retry.hidden=true;
  model.player.pause();this.equipment?.dispose();this.equipment=undefined;
  status.dataset['state']='loading';status.textContent='Cargando la espada y el escudo…';
  try{
   const {RuenEquipmentPreview}=await import('../assets/RuenEquipmentPreview');
   if(this.disposed||this.model!==model)return;
   const equipment=new RuenEquipmentPreview(this.scene,model,this.combatPreviewRequested?ruenRuntimeEquipmentProfiles:undefined);this.equipment=equipment;
   equipment.setEnabled(false);await equipment.load();
   if(this.disposed||this.model!==model){equipment.dispose();return;}
   const ready=equipment.diagnostics.status==='ready';
   status.dataset['state']=equipment.diagnostics.status;
   toggle.disabled=!ready;retry.hidden=ready;
   status.textContent=ready?(this.combatPreviewRequested?'Espada y escudo del juego. Selecciona guardia, bloqueo o un ataque; desmarca para volver al Idle sin equipo.':'Azure Oathblade y Aegis of the Azure. Desmarca para comparar con el Idle sin equipo.'):'No se pudo cargar todo el equipo. Puedes usar el Idle sin equipo y reintentar la carga.';
   let armedOption=Array.from(this.clips.options).find(option=>option.value===this.equippedIdleName);
   if(ready&&!armedOption){armedOption=new Option('Idle con espada y escudo · prototipo v1 · 4.000 s',this.equippedIdleName);this.clips.add(armedOption,0);}
   if(armedOption)armedOption.disabled=!ready;
   for(const clip of this.combatOptions){
    let option=Array.from(this.clips.options).find(item=>item.value===clip.name);
    if(ready&&!option){option=new Option(`${clip.label} · ${clip.duration.toFixed(3)} s`,clip.name);this.clips.add(option,this.combatOptions.indexOf(clip)+1);}
    if(option)option.disabled=!ready;
   }
   const selected=ready?(this.combatOptions.find(clip=>clip.label==='Guardia')?.name??this.equippedIdleName):this.idlePreviewName;
   if(selected){this.clips.value=selected;model.player.select(selected);model.player.pause();}
  }catch(error){
   if(this.disposed||this.model!==model)return;
   this.equipment?.setEnabled(false);status.dataset['state']='error';retry.hidden=false;
   for(const option of this.clips.options)if(option.value===this.equippedIdleName||this.combatOptions.some(clip=>clip.name===option.value))option.disabled=true;
   if(this.idlePreviewName){this.clips.value=this.idlePreviewName;model.player.select(this.idlePreviewName);model.player.pause();}
   status.textContent='No se pudo cargar el equipo. Reintenta la carga.';
   console.warn('Equipo de prueba no disponible.',error);
  }finally{
   if(!this.disposed&&this.model===model){this.controls.disabled=false;this.file.disabled=this.loadButton.disabled=false;this.updatePlayback();this.refreshReport();}
  }
 }
 private toggleEquipment():void{
  const player=this.model?.player;
  if(!player||this.equipment?.diagnostics.status!=='ready')return;
  const selected=this.element<HTMLInputElement>('asset-equipment-toggle').checked?this.equippedIdleName:this.idlePreviewName;
  if(!selected)return;
  const wasPlaying=player.isPlaying;
  const wasIdle=player.currentName===this.idlePreviewName||player.currentName===this.equippedIdleName;
  const frame=wasIdle?player.current?.getCurrentFrame()??0:0;
  player.select(selected);player.current?.goToFrame(frame);if(!wasPlaying)player.pause();
  this.clips.value=selected;this.updatePlayback();
 }
 private refreshReport():void{
  this.report.textContent=JSON.stringify({...this.reportData,...(this.equipment?{equipmentPreview:{...this.equipment.report,clip:this.equippedIdleName,notInMaster:true,gameplayIntegrated:this.combatPreviewRequested}}:{})},null,2);
 }
 private frameModel():void{
  if(!this.model)return;
  const bounds=this.model.root.getHierarchyBoundingVectors(true);
  if(Number.isFinite(bounds.min.y)&&Number.isFinite(bounds.max.y)){
   this.camera.setTarget(bounds.min.add(bounds.max).scale(.5));
   this.camera.radius=Math.max(1,bounds.max.subtract(bounds.min).length()*1.5);
  }
  if(this.combatOptions.length){
   // Leave room for the sword above the head and in front of the body.
   const scale=this.model.root.scaling.x;
   this.camera.setTarget(new Vector3(0,1.1*scale,0));
   this.camera.radius=Math.max(this.camera.radius,4.5*scale);
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
  if(this.equipmentRequested){
   const equipped=!!this.equippedIdleName&&(player.currentName===this.equippedIdleName||this.combatOptions.some(clip=>clip.name===player.currentName))&&this.equipment?.diagnostics.status==='ready';
   this.equipment?.setEnabled(equipped);this.element<HTMLInputElement>('asset-equipment-toggle').checked=equipped;
   if(this.equipment)this.refreshReport();
  }
  this.play.textContent=player.isPlaying?'Pausar':'Reproducir';
  this.playback.textContent=player.currentName?`${player.currentName} · ${player.isPlaying?'Reproduciendo':'Pausado'}`:'El archivo no contiene clips.';
  this.warning.textContent=player.currentName===this.idlePreviewName?'Idle neutro creado para Veylun · prototipo v1. No forma parte del archivo original. Revisa respiración, hombros, manos y capa desde las tres vistas.':motionWarnings[player.currentName??'']??(player.currentName==='Walking'||player.currentName==='Running'?'Clip original de locomoción. El juego usa una adaptación con agarres para espada y escudo.':'Sólo inspección. Sin asignación automática a estados del juego.');
  if(this.equippedIdleName&&player.currentName===this.equippedIdleName)this.warning.textContent='Idle con espada y escudo. Escudo reducido un 30%. Revisa la postura y el agarre desde las tres vistas; el juego incorpora versiones ligeras del equipo.';
  const combat=this.combatOptions.find(clip=>clip.name===player.currentName);
  if(combat)this.warning.textContent=`${combat.label} · animación propia de Veylun, sobre el esqueleto original. En el juego, el controlador decide el movimiento, el bloqueo y el daño. Este visor sólo muestra la animación.`;
 }
 private resize=():void=>this.engine.resize();
 private visibility=():void=>{if(document.hidden){this.model?.player.pause();this.updatePlayback();}};
 start():void{
  if(this.started||this.disposed)return;
  this.started=true;
  this.engine.runRenderLoop(()=>{if(!document.hidden)this.scene.render();});
  void this.load(assetUrl(masterPath));
 }
 dispose():void{
  this.disposed=true;window.removeEventListener('resize',this.resize);document.removeEventListener('visibilitychange',this.visibility);
  this.engine.stopRenderLoop();this.equipment?.dispose();this.model?.dispose();this.scene.dispose();this.engine.dispose();this.panel.remove();
  delete document.body.dataset['mode'];
  if(import.meta.env.DEV)delete (window as Window&{__assetInspector?:AssetInspector}).__assetInspector;
 }
}
