import type { Simulation } from '../core/Simulation';
import type { InputManager } from '../input/InputManager';
import { CombatHUD } from './CombatHUD';
import { guardianAttack } from '../enemies/guardianCombat';
import { distance } from '../core/math';
import { interactables } from '../world/level';
import { journeyHint } from '../progression/guidance';
export type Screen='start'|'pause'|'settings'|'controls'|'confirm'|'victory'|'none';
export const formatTime=(seconds:number):string=>`${Math.floor(seconds/60).toString().padStart(2,'0')}:${Math.floor(seconds%60).toString().padStart(2,'0')}`;
const heart='<path d="M12 21C9 18 2 13 2 7a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 6-7 11-10 14Z"/>';
export class UI {
 readonly combat:CombatHUD;
 screen:Screen='start';private menu:HTMLElement;private hud:HTMLElement;private selection=0;private toastUntil=0;private zoneUntil=0;
 readonly settings={volume:.35,distance:5.8,sensitivity:1,deadzone:.18,trigger:.5,shadows:true,invert:false};
 onAction:(action:string)=>void=()=>{};
 constructor(){
  document.querySelector('#app')!.insertAdjacentHTML('beforeend',`<div id="vignette"></div><header id="brand"><span class="brand-glyph">◇</span> VEYLUN <span class="version">EL SANTUARIO OLVIDADO</span></header>
  <section id="menu" aria-label="Menú principal"></section>
  <section id="hud" hidden><div id="health" aria-label="Salud"></div><div id="objective"><span>EL SANTUARIO OLVIDADO</span><p></p><small></small></div><div id="zone-title"></div><div id="toast" role="status"></div><div id="interaction"></div><div id="boss"><span>GUARDIÁN ANCESTRAL</span><div><i></i></div><small></small></div><div id="location"></div><div id="controls-hint"></div><div id="death-message">El bosque aún te necesita<small>Regresando al último recuerdo…</small></div><div id="restoration">La luz vuelve al santuario</div></section>
  <div id="save-warning" role="status"></div><div id="loading" role="status">Despertando el bosque…</div>`);
  this.menu=document.querySelector('#menu')!;this.hud=document.querySelector('#hud')!;
  document.querySelector('#objective')!.insertAdjacentHTML('beforeend','<div id="objective-help"></div>');
  document.querySelector('#boss>span')!.insertAdjacentHTML('beforeend','<b id="boss-health"></b>');
  const bossTrack=document.querySelector('#boss>div')!;
  bossTrack.setAttribute('role','progressbar');bossTrack.setAttribute('aria-label','Vida del Guardián');bossTrack.setAttribute('aria-valuemin','0');bossTrack.setAttribute('aria-valuemax','12');
  document.querySelector('#boss')!.insertAdjacentHTML('beforeend','<p id="boss-controls"></p>');
  this.hud.insertAdjacentHTML('beforeend','<section id="altar-guide" hidden><b>El santuario te espera</b><p>Sigue el haz de luz hasta el altar.</p><small></small></section>');
  document.querySelector('#restoration')!.innerHTML='<b>La luz vuelve al santuario</b><small id="restoration-stage"></small><div role="progressbar" aria-label="Restauración del santuario" aria-valuemin="0" aria-valuemax="100"><i></i></div>';
  this.combat=new CombatHUD(this.hud);
  this.menu.addEventListener('click',e=>{const button=(e.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');if(button)this.onAction(button.dataset['action']!);});
  this.menu.addEventListener('input',e=>{const el=e.target as HTMLInputElement,key=el.name as keyof typeof this.settings;if(key in this.settings){if(key==='shadows'||key==='invert')this.settings[key]=el.checked;else this.settings[key]=Number(el.value);this.onAction('settings-change');}});
 }
 ready():void{document.querySelector('#loading')?.remove();}
 show(screen:Screen,hasSave=false,stats?:{playedSeconds:number;deaths:number;completed?:boolean}):void{
  this.screen=screen;this.menu.hidden=screen==='none';this.hud.hidden=screen!=='none';this.selection=0;
  document.body.dataset['screen']=screen;
  const button=(action:string,label:string,primary=false)=>`<button data-action="${action}" class="${primary?'primary':''}">${label}<span aria-hidden="true">›</span></button>`;
  let content='';
  if(screen==='start')content=`<p class="eyebrow">UNA AVENTURA EN EL MUNDO DE VEYLUN</p><h1>El Santuario<br><em>Olvidado</em></h1><p class="intro-copy">Algo antiguo despierta entre las raíces.<br>Encuentra la llave. Devuelve la luz al bosque.</p><div class="menu-actions">${hasSave?button('continue','Continuar aventura',true):''}${button('new','Nueva partida',!hasSave)}${button('controls','Controles')}</div><p class="menu-footnote">Un jugador · Teclado y ratón · Control Xbox</p>`;
  if(screen==='pause')content=`<p class="eyebrow">UN MOMENTO ENTRE LAS RAÍCES</p><h1>Pausa</h1><div class="menu-actions">${button('resume','Continuar',true)}${stats?.completed?'':button('checkpoint','Volver al checkpoint')}${button('settings','Ajustes')}${button('controls','Controles')}${button('new','Reiniciar partida')}${button('menu','Volver al menú')}</div><p class="menu-footnote">Volver a un recuerdo conserva los objetos y enemigos derrotados.<br>Los enemigos vivos recuperan su salud.</p>`;
  if(screen==='settings')content=`<p class="eyebrow">A TU MANERA</p><h1>Ajustes</h1><div class="settings-grid">
  ${this.range('volume','Volumen',0,1,.05)}${this.range('distance','Distancia de cámara',3,8,.1)}${this.range('sensitivity','Sensibilidad de cámara',.3,2,.1)}${this.range('deadzone','Zona muerta del mando',.05,.4,.01)}${this.range('trigger','Umbral de gatillos',.1,.9,.05)}
  <label>Invertir eje vertical<input type="checkbox" name="invert" ${this.settings.invert?'checked':''}></label><label>Sombras<input type="checkbox" name="shadows" ${this.settings.shadows?'checked':''}></label></div>${button('back','Volver',true)}`;
  if(screen==='controls')content=`<p class="eyebrow">APRENDE A ESCUCHAR EL BOSQUE</p><h1>Controles</h1><div class="control-table"><div><b>Acción</b><b>Teclado / ratón</b><b>Xbox</b></div>${[
  ['Moverse','W A S D','Stick izquierdo'],['Cámara','Ratón / arrastrar','Stick derecho'],['Saltar','Espacio','A'],['Rodar','Shift','B'],['Espada','Clic izquierdo / J','X'],['Interactuar','E','Y'],['Escudo','Clic derecho / K','LT'],['Fijar objetivo','Q','RT'],['Cambiar objetivo','Tab','LB / RB'],['Pausa','Escape','Menu']].map(row=>`<div>${row.map(x=>`<span>${x}</span>`).join('')}</div>`).join('')}</div><p class="control-note">Ataca hasta tres veces para encadenar un combo. El escudo protege de frente; esquiva el golpe al suelo del Guardián. Sigue la luz turquesa para encontrar tu objetivo.</p><details><summary>Diagnóstico del mando</summary><p id="pad-diagnostic"></p><small>Los controles automáticos requieren mapping estándar. Si aparece otro mapping, usa teclado y ratón.</small></details>${button('back','Volver',true)}`;
  if(screen==='confirm')content=`<p class="eyebrow">COMENZAR DE NUEVO</p><h1>¿Borrar tu<br><em>progreso?</em></h1><p class="intro-copy">Se perderán los recuerdos, la llave y el progreso de esta aventura.</p><div class="menu-actions">${button('cancel','Conservar partida',true)}${button('confirm-new','Borrar y comenzar')}</div>`;
  if(screen==='victory')content=`<p class="eyebrow">LA LUZ HA VUELTO</p><h1>Santuario<br><em>restaurado</em></h1><p class="intro-copy">Las raíces recuerdan tu nombre, Ruen.<br>Esta historia apenas comienza.</p><div class="victory-stats"><div><b>${formatTime(stats?.playedSeconds??0)}</b><span>TIEMPO DE AVENTURA</span></div><div><b>${stats?.deaths??0}</b><span>VECES QUE VOLVISTE</span></div></div><div class="menu-actions">${button('new','Nueva aventura',true)}${button('menu','Volver al menú')}</div>`;
  this.menu.innerHTML=`<div class="menu-panel ${screen==='controls'?'wide':''}">${content}</div><div class="menu-caption"><span>◇</span> DONDE EL BOSQUE GUARDA SUS RECUERDOS</div>`;
 }
 private range(name:'volume'|'distance'|'sensitivity'|'deadzone'|'trigger',label:string,min:number,max:number,step:number):string{return `<label>${label}<input aria-label="${label}" name="${name}" type="range" min="${min}" max="${max}" step="${step}" value="${this.settings[name]}"></label>`;}
 menuGamepad(input:InputManager):void{
  if(this.screen==='none')return;
  const els=Array.from(this.menu.querySelectorAll<HTMLElement>('button,input,summary'));if(!els.length)return;
  if(input.menuMove){this.selection=(this.selection+input.menuMove+els.length)%els.length;els[this.selection]!.focus();}
  if(input.confirm)els[this.selection]?.click();
  const el=els[this.selection];if(input.menuHorizontal&&el instanceof HTMLInputElement&&el.type==='range'){el.value=String(Number(el.value)+input.menuHorizontal*Number(el.step));el.dispatchEvent(new Event('input',{bubbles:true}));}
  if(input.back&&this.screen!=='start'&&this.screen!=='victory')this.onAction(this.screen==='pause'?'resume':'back');
  const diagnostic=document.querySelector('#pad-diagnostic');if(diagnostic)diagnostic.textContent=input.diagnostic;
 }
 reset():void{
  this.combat.reset();this.toastUntil=this.zoneUntil=-1;
  for(const id of ['toast','zone-title']){const el=document.getElementById(id)!;el.textContent='';el.hidden=true;}
  document.body.classList.remove('hurt');
 }
 toast(text:string,time:number):void{const el=document.querySelector<HTMLElement>('#toast')!;el.textContent=text;el.hidden=false;this.toastUntil=time+4;}
 zone(text:string,time:number):void{const el=document.querySelector<HTMLElement>('#zone-title')!;el.textContent=text;el.hidden=false;this.zoneUntil=time+4;}
 warning(text:string):void{const el=document.querySelector<HTMLElement>('#save-warning')!;el.textContent=text;el.hidden=!text;}
 update(sim:Simulation,input:InputManager):void{
  const p=sim.player;const health=document.querySelector('#health')!;
  health.innerHTML=Array.from({length:5},(_,i)=>{const n=Math.max(0,Math.min(2,p.health-i*2));return `<span class="heart"><svg viewBox="0 0 24 24" class="empty">${heart}</svg><svg viewBox="0 0 24 24" style="clip-path:inset(0 ${100-n*50}% 0 0)">${heart}</svg></span>`;}).join('');health.setAttribute('aria-label',`Salud: ${p.health} de 10`);
  document.querySelector('#objective p')!.textContent=sim.objective();document.querySelector('#objective small')!.textContent=sim.save.hasKey?'◇ Llave del santuario':'';
  document.querySelector('#objective-help')!.textContent=journeyHint(sim,input.device==='gamepad');
  const prompt=sim.interaction();const interaction=document.querySelector<HTMLElement>('#interaction')!;interaction.hidden=!prompt;interaction.textContent=prompt?`${input.device==='gamepad'?'Y':'E'}  ·  ${prompt.label}`:'';
  const boss=sim.enemies[3]!,bossEl=document.querySelector<HTMLElement>('#boss')!;bossEl.hidden=!(sim.save.doorUnlocked&&p.z>94&&boss.hp>0);
  document.querySelector<HTMLElement>('#boss i')!.style.width=`${boss.hp/boss.maxHp*100}%`;
  document.querySelector('#boss>div')!.setAttribute('aria-valuenow',String(boss.hp));
  document.querySelector('#boss-health')!.textContent=`${boss.hp} / ${boss.maxHp}`;
  bossEl.dataset['state']=boss.state;
  const slam=guardianAttack(boss.attackIndex).kind==='slam';
  document.querySelector('#boss small')!.textContent=boss.state==='windup'?(slam?'Golpe al suelo · sal del círculo':'Golpe frontal · bloquea de frente'):
    boss.state==='attack'?(boss.hit?'El golpe ha pasado':slam?'¡Esquiva el impacto!':'¡Bloquea o esquiva!'):
    boss.state==='recover'?'Expuesto · acércate y ataca':'Mantén la distancia y observa sus brazos';
  document.querySelector('#boss-controls')!.textContent=boss.state==='recover'?(input.device==='gamepad'?'X · Espada':'J / clic · Espada'):
    slam?(input.device==='gamepad'?'Stick + B · Esquiva al impacto. El escudo no lo detiene.':'WASD + Shift · Esquiva al impacto. El escudo no lo detiene.'):
    input.device==='gamepad'?'LT · Escudo   B · Rodar   RT · Fijar':'K · Escudo   Shift · Rodar   Q · Fijar';
  const altarGuide=document.querySelector<HTMLElement>('#altar-guide')!;
  altarGuide.hidden=!sim.altarReady||sim.mode!=='playing'||p.z<94||distance(p,interactables['restoration-altar'])<2.2;
  altarGuide.querySelector('small')!.textContent=`${input.device==='gamepad'?'Y':'E'} · Restaurar al acercarte`;
  const names={awakening:'Claro del despertar',roots:'Sendero de las raíces',ruins:'Patio de las ruinas',gate:'Puerta del santuario',guardian:'Cámara del Guardián'};
  document.querySelector('#location')!.textContent=`◇ ${names[sim.zone]}`;
  document.querySelector('#controls-hint')!.textContent=input.device==='gamepad'?'X Espada   LT Escudo   B Rodar   RT Fijar   Menu Pausa':'J Espada   K Escudo   Shift Rodar   Q Fijar   Esc Pausa';
  document.querySelector<HTMLElement>('#toast')!.hidden=sim.age>this.toastUntil;
  document.querySelector<HTMLElement>('#zone-title')!.hidden=sim.age>this.zoneUntil;
  document.querySelector<HTMLElement>('#death-message')!.hidden=sim.mode!=='dead';
  document.querySelector<HTMLElement>('#restoration')!.hidden=sim.mode!=='restoring';
  const progress=sim.restorationProgress;
  document.querySelector('#restoration-stage')!.textContent=progress<1/3?'Las runas despiertan':progress<2/3?'Las raíces recobran su luz':'El santuario vuelve a respirar';
  document.querySelector('#restoration>div')!.setAttribute('aria-valuenow',String(Math.round(progress*100)));
  document.querySelector<HTMLElement>('#restoration i')!.style.width=`${progress*100}%`;
  document.body.classList.toggle('hurt',p.invulnerable>.5);
 }
}
