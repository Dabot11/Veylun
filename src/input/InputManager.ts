import { gameConfig } from '../config/gameConfig';
import { xboxStandardButtons, keyboardCodes, type Action } from './actions';
export function radialDeadzone(x:number,y:number,deadzone:number):{x:number;y:number}{
 const length=Math.hypot(x,y);if(length<=deadzone)return{x:0,y:0};const scale=Math.min(1,(length-deadzone)/(1-deadzone))/length;return{x:x*scale,y:y*scale};
}
export class InputManager {
  active=false;keys=new Set<string>();pressed=new Set<Action>();private mouse=new Set<number>();private lastButtons:boolean[]=[];
  movement={x:0,y:0};look={x:0,y:0};device:'keyboard-mouse'|'gamepad'='keyboard-mouse';
  gamepad:Gamepad|null=null;diagnostic='Sin mando conectado';connectionNotice='';
  deadzone:number=gameConfig.input.deadzone;triggerThreshold:number=gameConfig.input.triggerThreshold;
  private mouseX=0;private mouseY=0;private wheel=0;zoom=0;private menuAxis=0;menuMove=0;confirm=false;back=false;menuHorizontal=0;
  constructor(private canvas:HTMLCanvasElement){
    window.addEventListener('keydown',this.keyDown);window.addEventListener('keyup',this.keyUp);
    canvas.addEventListener('mousedown',this.mouseDown);window.addEventListener('mouseup',this.mouseUp);
    window.addEventListener('mousemove',this.mouseMove);canvas.addEventListener('contextmenu',this.contextMenu);
    canvas.addEventListener('wheel',this.onWheel,{passive:false});window.addEventListener('blur',this.clear);
    window.addEventListener('gamepadconnected',this.connected);window.addEventListener('gamepaddisconnected',this.disconnected);
  }
  private keyDown=(e:KeyboardEvent):void=>{
    if(e.target instanceof HTMLInputElement||(!this.active&&e.code!=='Escape'))return;
    if(['Space','Tab','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();
    if(!this.keys.has(e.code)){for(const[a,codes]of Object.entries(keyboardCodes))if(codes?.includes(e.code))this.pressed.add(a as Action);}
    this.keys.add(e.code);this.device='keyboard-mouse';
  };
  private keyUp=(e:KeyboardEvent):void=>{this.keys.delete(e.code);};
  private mouseDown=(e:MouseEvent):void=>{this.mouse.add(e.button);this.device='keyboard-mouse';if(e.button===0)this.pressed.add('attack');};
  private mouseUp=(e:MouseEvent):void=>{this.mouse.delete(e.button);};
  private mouseMove=(e:MouseEvent):void=>{if(document.pointerLockElement===this.canvas||this.mouse.has(0)||this.mouse.has(2)){this.mouseX+=e.movementX;this.mouseY+=e.movementY;}};
  private onWheel=(e:WheelEvent):void=>{e.preventDefault();this.wheel+=e.deltaY;};
  private contextMenu=(e:Event):void=>{e.preventDefault();};
  private connected=(e:GamepadEvent):void=>{this.connectionNotice=`Mando conectado: ${e.gamepad.id}`;this.lastButtons=[];};
  private disconnected=():void=>{this.connectionNotice='Mando desconectado · teclado disponible';this.gamepad=null;this.lastButtons=[];};
  clear=():void=>{this.keys.clear();this.mouse.clear();this.pressed.clear();this.mouseX=0;this.mouseY=0;};
  poll():void{
    this.menuMove=0;this.confirm=false;this.back=false;this.menuHorizontal=0;
    let x=Number(this.keys.has('KeyD'))-Number(this.keys.has('KeyA'));
    let y=Number(this.keys.has('KeyW'))-Number(this.keys.has('KeyS'));
    let lx=0,ly=0;
    const pads=navigator.getGamepads?.()??[];this.gamepad=Array.from(pads).find(g=>g?.connected)??null;
    if(this.gamepad){
      const pad=this.gamepad;
      this.diagnostic=`${pad.id} · mapping: ${pad.mapping||'no estándar'} · ejes: ${pad.axes.map(a=>a.toFixed(2)).join(', ')} · botones: ${pad.buttons.map((b,i)=>b.value>.1?`${i}:${b.value.toFixed(2)}`:'').filter(Boolean).join(' ')||'—'}`;
      if(pad.mapping==='standard'){
        const left=radialDeadzone(pad.axes[0]??0,-(pad.axes[1]??0),this.deadzone),right=radialDeadzone(pad.axes[2]??0,pad.axes[3]??0,this.deadzone);
        x+=left.x;y+=left.y;lx=right.x;ly=right.y;
        for(const[action,index]of Object.entries(xboxStandardButtons)){
          const button=pad.buttons[index];const down=(button?.value??0)>(index===6||index===7?this.triggerThreshold:.5);
          if(down&&!this.lastButtons[index])this.pressed.add(action as Action);
          if(down)this.device='gamepad';
        }
        this.confirm=!!pad.buttons[0]?.pressed&&!this.lastButtons[0];this.back=!!pad.buttons[1]?.pressed&&!this.lastButtons[1];
        const axis=left.y>.6?-1:left.y<-.6?1:pad.buttons[12]?.pressed?-1:pad.buttons[13]?.pressed?1:0;
        if(axis!==this.menuAxis)this.menuMove=axis;this.menuAxis=axis;
        this.menuHorizontal=pad.buttons[14]?.pressed?-1:pad.buttons[15]?.pressed?1:0;
        if(Math.abs(left.x)+Math.abs(left.y)+Math.abs(right.x)+Math.abs(right.y)>.05)this.device='gamepad';
      }
      this.lastButtons=pad.buttons.map((b,i)=>b.value>(i===6||i===7?this.triggerThreshold:.5));
    }else{this.diagnostic='Sin mando conectado. Pulsa un botón del Xbox para activarlo.';this.lastButtons=[];}
    const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}this.movement={x,y};
    this.look={x:lx,y:ly};this.zoom=this.wheel;this.wheel=0;
  }
  consumeLook(dt:number,sensitivity:number,invert:boolean):{x:number;y:number}{
    const x=this.mouseX*.003*sensitivity+this.look.x*dt*2.4*sensitivity;
    const y=(this.mouseY*.003*sensitivity+this.look.y*dt*1.8*sensitivity)*(invert?-1:1);
    this.mouseX=0;this.mouseY=0;return{x,y};
  }
  take(action:Action):boolean{const p=this.pressed.has(action);this.pressed.delete(action);return p;}
  get shield():boolean{return this.keys.has('KeyK')||this.mouse.has(2)||(this.gamepad?.mapping==='standard'&&(this.gamepad.buttons[6]?.value??0)>this.triggerThreshold);}
  lock():void{try{const r=this.canvas.requestPointerLock();if(r instanceof Promise)void r.catch(()=>{});}catch{/* Drag camera remains available. */}}
  dispose():void{
    window.removeEventListener('keydown',this.keyDown);window.removeEventListener('keyup',this.keyUp);this.canvas.removeEventListener('mousedown',this.mouseDown);window.removeEventListener('mouseup',this.mouseUp);window.removeEventListener('mousemove',this.mouseMove);this.canvas.removeEventListener('contextmenu',this.contextMenu);this.canvas.removeEventListener('wheel',this.onWheel);window.removeEventListener('blur',this.clear);window.removeEventListener('gamepadconnected',this.connected);window.removeEventListener('gamepaddisconnected',this.disconnected);
  }
}
