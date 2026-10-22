import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import '@babylonjs/core/Culling/ray';
import { Simulation } from './Simulation';
import { FixedStepLoop } from './FixedStepLoop';
import { SaveStore, freshSave } from '../progression/save';
import { WorldView } from '../world/WorldView';
import { FollowCamera } from '../camera/FollowCamera';
import { InputManager } from '../input/InputManager';
import { AudioManager } from '../audio/AudioManager';
import { UI, type Screen } from '../ui/UI';
import { zoneAt } from '../world/level';
import type { RuenLocomotionView } from '../assets/RuenLocomotionView';
export class Application {
 readonly engine:Engine;readonly scene:Scene;sim:Simulation;readonly world:WorldView;readonly camera:FollowCamera;readonly input:InputManager;readonly ui:UI;
 private audio=new AudioManager();private store:SaveStore;private loop=new FixedStepLoop();private shadows:ShadowGenerator;private previous=performance.now();private menuReturn:Screen='start';private pendingReturn:Screen='start';private frame=0;private needsRender=true;
 private adventureStarted=false;
 private ruenLocomotion:RuenLocomotionView|undefined;
 private ruenStatus:HTMLElement|undefined;
 constructor(readonly canvas:HTMLCanvasElement){
  this.engine=new Engine(canvas,true,{stencil:true});this.engine.setHardwareScalingLevel(1/Math.min(devicePixelRatio||1,1.5));
  this.scene=new Scene(this.engine);this.scene.clearColor=new Color4(.62,.77,.73,1);this.scene.fogMode=Scene.FOGMODE_EXP2;this.scene.fogDensity=.017;this.scene.fogColor=new Color3(.62,.77,.66);
  const ambient=new HemisphericLight('forest-sky',new Vector3(0,1,0),this.scene);ambient.intensity=.78;ambient.groundColor=new Color3(.25,.32,.18);
  const sun=new DirectionalLight('warm-sun',new Vector3(.6,-1,.5),this.scene);sun.position.set(-20,40,-15);sun.intensity=.9;sun.diffuse=new Color3(1,.91,.68);
  let storage:Storage|undefined;try{storage=localStorage;}catch{/* SaveStore retains the session and shows the storage warning. */}
  this.store=new SaveStore(storage);const save=this.store.read();this.sim=new Simulation(save??freshSave());
  this.world=new WorldView(this.scene,this.sim);this.camera=new FollowCamera(this.scene);this.camera.reset(this.sim);
  this.shadows=new ShadowGenerator(1024,sun);this.shadows.usePercentageCloserFiltering=true;this.shadows.bias=.002;this.shadows.normalBias=.02;this.shadows.darkness=.22;
  for(const m of this.world.shadowCasters)this.shadows.addShadowCaster(m);
  this.input=new InputManager(canvas,()=>this.ui?.screen==='none');this.ui=new UI();this.ui.onAction=this.action;this.ui.show('start',!!save);this.ui.warning(this.store.warning);
  window.addEventListener('resize',this.resize);document.addEventListener('visibilitychange',this.visibility);window.addEventListener('pagehide',this.persist);
  canvas.addEventListener('click',this.lock);
  this.scene.executeWhenReady(()=>{this.ui.ready();this.needsRender=true;document.body.dataset['engine']='ready';});
  void this.world.visualOverrides.load(this.scene,this.world.hero,this.world.enemyRigs);
  if(new URLSearchParams(location.search).get('ruen')!=='provisional')void this.enableRuenModel();
  if(import.meta.env.DEV&&new URLSearchParams(location.search).has('test')){
   const app=this;Object.assign(window,{__veylun:{get sim(){return app.sim;},get camera(){return app.camera;},get ui(){return app.ui;},get locomotion(){return app.ruenLocomotion;}}});
  }
 }
 private async enableRuenModel():Promise<void>{
  const panel=document.createElement('aside');panel.id='ruen-model-trial';
  panel.innerHTML=`<strong>RUEN</strong><span id="ruen-model-status" role="status" data-status="loading">Cargando Ruen…</span><small>Reposo provisional · animaciones de acción en revisión</small><nav><a href="${import.meta.env.BASE_URL}?inspect=ruen">Visor de animaciones</a><a href="${import.meta.env.BASE_URL}?ruen=provisional">Modelo provisional</a></nav>`;
  document.querySelector('#app')!.append(panel);this.ruenStatus=panel.querySelector('#ruen-model-status')!;
  try{
   await import('../ui/ruenTrial.css');
   const {RuenLocomotionView}=await import('../assets/RuenLocomotionView');
   if(this.scene.isDisposed)return;
   this.ruenLocomotion=new RuenLocomotionView(this.scene,this.world.hero);
   await this.ruenLocomotion.load();
   if(this.scene.isDisposed)return;
   for(const mesh of this.ruenLocomotion.model?.container.meshes??[])this.shadows.addShadowCaster(mesh);
   this.needsRender=true;this.updateRuenStatus();
  }catch(error){
   if(this.scene.isDisposed)return;
   this.ruenStatus.dataset['status']='error';this.ruenStatus.textContent='No se pudo cargar Ruen. Se muestra el modelo provisional.';
   console.warn('Ruen: se conserva el modelo provisional.',error);
  }
 }
 private updateRuenStatus():void{
  if(!this.ruenStatus||!this.ruenLocomotion)return;
  const d=this.ruenLocomotion.diagnostics;
  this.ruenStatus.dataset['status']=d.status;this.ruenStatus.dataset['representation']=d.representation;
  const states:Record<string,string>={idle:'reposo',jump:'salto',fall:'caída',land:'aterrizaje',roll:'esquiva',shield:'defensa',attack1:'ataque 1',attack2:'ataque 2',attack3:'ataque 3',hurt:'daño',death:'muerte',interact:'interacción',victory:'victoria'};
  const label=d.status==='loading'?'Cargando Ruen…':d.status==='error'?'No se pudo cargar Ruen. Se muestra el modelo provisional.':d.representation==='meshy'?`Ruen · ${this.sim.player.state==='idle'?'reposo provisional':this.sim.player.state==='walk'?'caminando':'corriendo'}`:`Modelo provisional · ${states[this.sim.player.state]??'movimiento no validado'}`;
  if(this.ruenStatus.textContent!==label)this.ruenStatus.textContent=label;
 }
 private resize=():void=>{this.engine.resize();this.needsRender=true;};
 private visibility=():void=>{if(document.hidden&&this.ui.screen==='none'){this.pause();this.persist();}this.previous=performance.now();this.loop.reset();};
 private persist=():void=>{if(this.adventureStarted)this.store.write(this.sim.save);};
 private lock=():void=>{if(this.ui.screen==='none'){this.input.lock();this.audio.unlock();}};
 private pause():void{this.ui.show('pause',false,this.sim.save);document.exitPointerLock?.();this.input.clear();this.loop.reset();this.needsRender=true;}
 private resume():void{this.ui.show('none');this.input.clear();this.loop.reset();this.previous=performance.now();this.input.lock();}
 private startGame(load:boolean):void{
  this.sim=new Simulation(load?(this.store.read()??freshSave()):freshSave());
  this.adventureStarted=true;this.ui.reset();this.world.combatEffects.reset();
  this.world.enemyRigs.forEach(r=>r.root.setEnabled(true));this.camera.reset(this.sim);this.loop.reset();this.input.clear();
  this.previous=performance.now();
  this.ui.show(this.sim.mode==='won'?'victory':'none',false,this.sim.save);this.store.write(this.sim.save);
  this.ui.update(this.sim,this.input);this.ui.zone(zoneAt(this.sim.player.z).name,this.sim.age);
  if(load&&this.sim.mode!=='won')this.ui.toast('Continúas desde el último recuerdo. Tu progreso se conserva.',this.sim.age);
  if(this.sim.mode!=='won')this.input.lock();
 }
 private action=(action:string):void=>{
  this.audio.unlock();this.needsRender=true;
  if(action==='new'){if(this.store.read()){this.pendingReturn=this.ui.screen;this.ui.show('confirm');}else this.startGame(false);}
  else if(action==='confirm-new'){this.store.clear();this.startGame(false);}
  else if(action==='cancel'){this.ui.show(this.pendingReturn,!!this.store.read(),this.sim.save);}
  else if(action==='continue')this.startGame(true);
  else if(action==='resume')this.resume();
  else if(action==='checkpoint'){this.sim.respawn();this.camera.reset(this.sim);this.resume();}
  else if(action==='settings'||action==='controls'){this.menuReturn=this.ui.screen;this.ui.show(action);}
  else if(action==='back'){this.ui.show(this.ui.screen==='confirm'?this.pendingReturn:this.menuReturn,!!this.store.read(),this.sim.save);}
  else if(action==='menu'){this.store.write(this.sim.save);this.ui.show('start',true);document.exitPointerLock?.();}
  else if(action==='settings-change'){const s=this.ui.settings;this.audio.volume=s.volume;this.camera.distance=s.distance;this.camera.sensitivity=s.sensitivity;this.camera.invert=s.invert;this.input.deadzone=s.deadzone;this.input.triggerThreshold=s.trigger;this.scene.shadowsEnabled=s.shadows;}
 };
 private render=():void=>{
  const now=performance.now(),frameSeconds=(now-this.previous)/1000,dt=Math.min(.1,frameSeconds);this.previous=now;this.input.poll();
  if(this.input.take('pause')){if(this.ui.screen==='none')this.pause();else if(this.ui.screen==='pause')this.resume();else if(this.ui.screen==='settings'||this.ui.screen==='controls')this.action('back');}
  if(this.ui.screen==='none'){
    const look=this.input.consumeLook(dt,this.camera.sensitivity,this.camera.invert);
    this.camera.update(this.sim,dt,look,this.input.zoom);
    this.loop.advance(dt,step=>{
      const a=this.camera.yaw,x=this.input.movement.x,z=this.input.movement.y;
      this.sim.step(step,{x:x*Math.cos(a)+z*Math.sin(a),z:z*Math.cos(a)-x*Math.sin(a),viewYaw:a,jump:this.input.take('jump'),dodge:this.input.take('dodge'),attack:this.input.take('attack'),shield:this.input.shield,interact:this.input.take('interact'),target:this.input.take('target'),cycle:this.input.take('nextTarget')?1:this.input.take('previousTarget')?-1:0});
    });
    for(const e of this.sim.events){
      if(e.type==='save')this.store.write(this.sim.save);
      else if(e.type==='respawn'){this.camera.reset(this.sim);this.input.clear();this.ui.reset();this.world.combatEffects.reset();this.ui.zone(zoneAt(this.sim.player.z).name,this.sim.age);this.ui.toast('Regresaste al último recuerdo. Salud restaurada y progreso conservado.',this.sim.age);}
      else if(e.type==='zone')this.ui.zone(e.text??'',this.sim.age);
      else{this.audio.play(e.type,e.strong);this.ui.combat.feedback(e,this.sim);this.world.combatEffects.emit(e);if(e.text)this.ui.toast(e.text,this.sim.age);}
    }
    this.sim.events=[];
    if(this.sim.player.state==='run'||this.sim.player.state==='walk')this.audio.play('step');
    if(this.sim.mode==='won'){this.ui.show('victory',true,this.sim.save);document.exitPointerLock?.();}
    if(this.input.connectionNotice){this.ui.toast(this.input.connectionNotice,this.sim.age);this.input.connectionNotice='';}
    if(this.frame++%4===0)this.ui.update(this.sim,this.input);
    this.ui.combat.update(this.sim,this.input.device);
  }else{
    this.ui.menuGamepad(this.input);this.input.pressed.clear();this.input.consumeLook(dt,1,false);
  }
  if(this.ui.screen==='none'||this.needsRender||!this.scene.isReady()){
   this.world.update(this.sim,dt);this.ruenLocomotion?.update(this.sim,this.ui.screen==='none',frameSeconds>0?dt/frameSeconds:0);this.updateRuenStatus();
   this.scene.render();this.needsRender=false;
  }this.ui.warning(this.store.warning);
 };
 start():void{this.previous=performance.now();this.engine.runRenderLoop(this.render);}
 dispose():void{window.removeEventListener('resize',this.resize);document.removeEventListener('visibilitychange',this.visibility);window.removeEventListener('pagehide',this.persist);this.canvas.removeEventListener('click',this.lock);this.input.dispose();this.audio.dispose();this.engine.stopRenderLoop();this.ruenLocomotion?.dispose();this.ruenStatus?.parentElement?.remove();this.scene.dispose();this.engine.dispose();}
}
