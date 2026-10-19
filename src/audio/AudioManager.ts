export class AudioManager {
  private context:AudioContext|null=null;
  volume=.35;
  private lastStep=0;
  unlock():void{try{this.context??=new AudioContext();void this.context.resume();}catch{/* Audio may be unavailable. */}}
  play(name:string):void{
    if(!this.context||this.context.state!=='running'||this.volume===0)return;
    const ctx=this.context,t=ctx.currentTime;
    if(name==='step'){if(t-this.lastStep<.28)return;this.lastStep=t;}
    const notes:Record<string,number[]>={step:[110],sword:[360,160],hit:[150,75],hurt:[160,100],shield:[650,950],dodge:[220,90],projectile:[780,480],switch:[420,640],door:[100,160],chest:[523,659,784],checkpoint:[392,523,659],death:[220,165,110],restore:[262,330,392,523,659],victory:[523,659,784,1047]};
    const seq=notes[name];if(!seq)return;
    seq.forEach((frequency,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type=['hit','hurt','step'].includes(name)?'triangle':'sine';o.frequency.setValueAtTime(frequency,t+i*.12);g.gain.setValueAtTime(0,t+i*.12);g.gain.linearRampToValueAtTime(this.volume*(name==='step'?.05:.17),t+i*.12+.012);g.gain.exponentialRampToValueAtTime(.0001,t+i*.12+.22);o.connect(g);g.connect(ctx.destination);o.start(t+i*.12);o.stop(t+i*.12+.25);o.onended=()=>{o.disconnect();g.disconnect();};});
  }
  dispose():void{void this.context?.close();}
}
