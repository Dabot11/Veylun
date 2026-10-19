import { angleDelta, angleTo, clamp, distance, type V2 } from './math';
import { checkpoints, groundHeight, interactables, moveWithCollisions, clearMeleePath, firstSolidHit, zones, zoneAt } from '../world/level';
import { ruinsWaypoint } from '../progression/guidance';
import { freshSave } from '../progression/save';
import type { SaveDataV1, ZoneId } from '../progression/types';
import type { OrdinaryEnemyId, EnemyType, EnemyState } from '../enemies/types';
import type { InteractionId } from '../interactions/types';
import type { PlayerState } from '../player/types';
import { attacks, shieldBlocks, swordHits } from '../player/combat';
import { gameConfig as config } from '../config/gameConfig';
import { spiritCombat, segmentCircleEntry } from '../enemies/spiritCombat';
import { guardianAttack, guardianCombat, guardianHits } from '../enemies/guardianCombat';
export interface Commands { x: number; z: number; jump?: boolean; dodge?: boolean; attack?: boolean; shield?: boolean; interact?: boolean; target?: boolean; cycle?: number; viewYaw?: number }
export interface Player extends V2 { y: number; vx: number; vz: number; vy: number; yaw: number; health: number; grounded: boolean; state: PlayerState; stateTime: number; invulnerable: number; rollCooldown: number; combo: number; attackTime: number; attackBuffer: number; queued: boolean; shield: boolean; coyote: number; jumpBuffer: number; rollX: number; rollZ: number; hitIds: Set<string> }
export interface Enemy extends V2 { id: string; kind: EnemyType; y: number; yaw: number; radius: number; hp: number; maxHp: number; state: EnemyState; timer: number; age: number; home: V2; attackIndex: number; hit: boolean; hurt: number; stagger: number; aim: V2 }
export interface Projectile extends V2 { id: number; ownerId: string; y: number; vx: number; vz: number; life: number }
export interface GameEvent { type: string; text?: string; x?: number; y?: number; z?: number; enemyId?: string; damage?: number; strong?: boolean }
export class Simulation {
  save: SaveDataV1;
  player: Player;
  enemies: Enemy[];
  projectiles: Projectile[] = [];
  events: GameEvent[] = [];
  targetId: string | null = null;
  mode: 'playing' | 'dead' | 'restoring' | 'won' = 'playing';
  modeTime = 0;
  zone: ZoneId = 'awakening';
  age = 0;
  private projectileId = 0;
  private autoSave = 0;
  private lostTargetTime = 0;
  private sproutAttackCooldown = 0;
  constructor(save = freshSave()) {
    this.save = structuredClone(save);
    this.player = this.makePlayer();
    this.zone = zoneAt(this.player.z).id;
    this.enemies = [this.enemy('sprout-1','sprout',-2,28,3),this.enemy('sprout-2','sprout',3,34,3),this.enemy('spirit-1','spirit',-2,56,2),this.enemy('guardian','guardian',0,114,12)];
    for (const e of this.enemies) if (e.kind === 'guardian' ? save.bossDefeated : save.defeatedOrdinaryEnemies.includes(e.id as OrdinaryEnemyId)) { e.hp = 0; e.state = 'dead'; e.timer = 3; }
    if (save.completed) this.mode = 'won';
  }
  private makePlayer(): Player {
    const p = checkpoints[this.save.checkpoint];
    return { ...p, y: groundHeight(p.x,p.z), vx: 0, vz: 0, vy: 0, yaw: 0, health: 10, grounded: true, state: 'idle', stateTime: 0, invulnerable: 0, rollCooldown: 0, combo: 0, attackTime: -1, attackBuffer: 0, queued: false, shield: false, coyote: .1, jumpBuffer: 0, rollX: 0, rollZ: 1, hitIds: new Set() };
  }
  private enemy(id: string, kind: EnemyType, x: number, z: number, hp: number): Enemy {
    return {id,kind,x,z,y:groundHeight(x,z)+(kind==='spirit'?.7:0),yaw:Math.PI,radius:kind==='guardian'?1.15:kind==='sprout'?.55:.35,hp,maxHp:hp,state:'idle',timer:0,age:0,home:{x,z},attackIndex:0,hit:false,hurt:0,stagger:0,aim:{x,z}};
  }
  emit(type: string, text?: string, pos?: V2): void {
    const e: GameEvent = { type }; if (text) e.text = text; if (pos) { e.x=pos.x;e.z=pos.z; } this.events.push(e);
  }
  persist(): void { this.emit('save'); }
  get target(): Enemy | undefined { return this.enemies.find(e => e.id===this.targetId && e.hp>0); }
  get ruinsSwitchReady():boolean { return this.save.defeatedOrdinaryEnemies.includes('spirit-1')&&!this.save.switchActivated; }
  get altarReady():boolean { return this.save.bossDefeated&&!this.save.altarActivated; }
  get restorationProgress():number { return this.mode==='restoring'?clamp(this.modeTime/guardianCombat.restorationDuration,0,1):this.save.completed?1:0; }
  visibleEnemy(e:Enemy):boolean { return clearMeleePath({...this.player,y:this.player.y+.8},{...e,y:e.y+.8},this.save); }
  targets(): Enemy[] { return this.enemies.filter(e=>e.hp>0 && distance(e,this.player)<config.camera.lockRange && (e.kind!=='guardian'||this.save.doorUnlocked) && this.visibleEnemy(e)); }
  selectTarget(cycle = 0, viewYaw = this.player.yaw): void {
    const candidates=this.targets();this.lostTargetTime=0;
    if (!cycle && this.targetId) { this.targetId=null;return; }
    const bearing=(e:Enemy):number=>angleDelta(viewYaw,angleTo(this.player,e));
    candidates.sort((a,b)=>bearing(a)-bearing(b));
    const index=candidates.findIndex(e=>e.id===this.targetId);
    if(cycle&&index>=0)this.targetId=candidates[(index+Math.sign(cycle)+candidates.length)%candidates.length]?.id??null;
    else this.targetId=candidates.sort((a,b)=>(Math.abs(bearing(a))*3+distance(a,this.player)*.15)-(Math.abs(bearing(b))*3+distance(b,this.player)*.15))[0]?.id??null;
  }
  step(dt: number, input: Commands): void {
    this.age+=dt;
    if (this.mode !== 'playing') {
      this.modeTime+=dt;this.player.stateTime+=dt;
      for(const enemy of this.enemies)if(enemy.hp<=0)enemy.timer+=dt;
      if (this.mode==='dead' && this.modeTime>1.6) this.respawn();
      if (this.mode==='restoring' && this.modeTime>guardianCombat.restorationDuration) {this.mode='won';this.emit('victory');}
      return;
    }
    this.save.playedSeconds+=dt; this.autoSave+=dt;
    if(this.autoSave>8){this.autoSave=0;this.persist();}
    const p=this.player;
    if(![p.x,p.y,p.z].every(Number.isFinite)||p.y < -12||Math.abs(p.x)>20||p.z < -18||p.z>140){this.respawn();return;}
    this.sproutAttackCooldown=Math.max(0,this.sproutAttackCooldown-dt);
    if(input.target)this.selectTarget(0,input.viewYaw); if(input.cycle)this.selectTarget(input.cycle,input.viewYaw);
    if(this.targetId && (!this.target || distance(this.target,p)>17))this.targetId=null;
    if(this.target){this.lostTargetTime=this.visibleEnemy(this.target)?0:this.lostTargetTime+dt;if(this.lostTargetTime>.6)this.targetId=null;}
    p.invulnerable=Math.max(0,p.invulnerable-dt);p.rollCooldown=Math.max(0,p.rollCooldown-dt);p.stateTime+=dt;
    p.coyote=p.grounded?.1:Math.max(0,p.coyote-dt);p.jumpBuffer=input.jump?.12:Math.max(0,p.jumpBuffer-dt);
    p.attackBuffer=input.attack?config.combat.attackBuffer:Math.max(0,p.attackBuffer-dt);
    if(p.state==='interact' && p.stateTime>.5)p.state='idle';
    if(p.state==='hurt' && p.stateTime>.3)p.state='idle';
    if(p.state==='land' && p.stateTime>.12)p.state='idle';
    if(p.state==='roll' && p.stateTime>=.45){p.state='idle';p.stateTime=0;}
    if(input.dodge && p.state!=='roll' && p.state!=='hurt' && p.rollCooldown===0 && p.grounded){
      p.state='roll';p.stateTime=0;p.rollCooldown=.8;p.attackTime=-1;p.attackBuffer=0;p.queued=false;p.combo=0;p.jumpBuffer=0;
      const m=Math.hypot(input.x,input.z);p.rollX=m>.1?input.x/m:Math.sin(p.yaw);p.rollZ=m>.1?input.z/m:Math.cos(p.yaw);this.emit('dodge');
    }
    const canAct=p.state!=='roll'&&p.state!=='hurt'&&p.state!=='interact';
    p.shield=!!input.shield&&p.state!=='roll'&&p.state!=='hurt'&&p.attackTime<0;
    if(p.attackBuffer>0&&canAct&&!p.shield){
      if(p.attackTime<0)this.beginAttack(1,input);
      else if(p.combo<3){p.queued=true;p.attackBuffer=0;}
    }
    if(p.jumpBuffer>0 && p.coyote>0 && canAct && p.attackTime<0){p.vy=Math.sqrt(-2*config.player.gravity*config.player.jumpHeight);p.grounded=false;p.coyote=0;p.jumpBuffer=0;p.state='jump';p.stateTime=0;}
    if(p.attackTime>=0){
      p.attackTime+=dt;const a=attacks[p.combo-1]!;
      if(p.attackTime>=a.windup&&p.attackTime<a.activeEnd){
        for(const e of this.enemies)if(e.hp>0&&!p.hitIds.has(e.id)&&swordHits(p,p.yaw,p.y,e)&&clearMeleePath({...p,y:p.y+.8},{...e,y:e.y+.6},this.save)){
          p.hitIds.add(e.id);this.damageEnemy(e,a.damage);
        }
      }
      if(p.attackTime>=a.duration){if(p.queued&&p.combo<3)this.beginAttack(p.combo+1,input);else{p.attackTime=-1;p.combo=0;p.queued=false;p.state='idle';}}
    }
    const magnitude=Math.min(1,Math.hypot(input.x,input.z));
    const speed=p.shield?1.6:p.attackTime>=0?.6:config.player.runSpeed;
    const blend=1-Math.exp(-14*dt);
    p.vx+=(input.x*speed-p.vx)*blend;p.vz+=(input.z*speed-p.vz)*blend;
    if(p.state==='roll'){p.vx=p.rollX*8;p.vz=p.rollZ*8;}
    if(p.state==='hurt'){p.vx*=.9;p.vz*=.9;}
    const moved=moveWithCollisions(p,p.vx*dt,p.vz*dt,.28,p.y,this.save);p.x=moved.x;p.z=moved.z;
    for(const e of this.enemies)if(e.hp>0&&Math.abs(p.y-e.y)<1.5){const d=distance(p,e),limit=e.radius+.27;if(d<limit&&d>.001){const push=moveWithCollisions(p,(p.x-e.x)/d*(limit-d),(p.z-e.z)/d*(limit-d),.28,p.y,this.save);p.x=push.x;p.z=push.z;}}
    if(this.target)p.yaw+=angleDelta(p.yaw,angleTo(p,this.target))*Math.min(1,dt*18);
    else if(magnitude>.1&&p.attackTime<0&&p.state!=='roll')p.yaw+=angleDelta(p.yaw,Math.atan2(input.x,input.z))*Math.min(1,dt*14);
    p.vy+=config.player.gravity*dt;p.y+=p.vy*dt;
    const floor=groundHeight(p.x,p.z);
    if(p.y<=floor){const landed=!p.grounded;p.y=floor;p.vy=0;p.grounded=true;if(landed&&p.attackTime<0&&p.state!=='roll'){p.state='land';p.stateTime=0;}}
    else p.grounded=false;
    if(p.attackTime<0&&!['roll','hurt','interact','land'].includes(p.state)) p.state=!p.grounded?(p.vy>0?'jump':'fall'):p.shield?'shield':magnitude>.7?'run':magnitude>.08?'walk':'idle';
    if(p.y<-12||!Number.isFinite(p.x)||!Number.isFinite(p.z)){this.respawn();return;}
    for(const e of this.enemies)this.updateEnemy(e,dt);
    this.updateProjectiles(dt);
    if(this.mode!=='playing')return;
    if(input.interact)this.interact();
    this.updateProgress();
  }
  private beginAttack(combo:number,input:Commands):void{
    const p=this.player;
    // Resolve the strike direction before its hit window, including a turn and
    // attack received on the same frame. A locked target takes precedence.
    if(this.target)p.yaw=angleTo(p,this.target);
    else if(Math.hypot(input.x,input.z)>.1)p.yaw=Math.atan2(input.x,input.z);
    p.combo=combo;p.attackTime=0;p.attackBuffer=0;p.queued=false;p.hitIds.clear();p.state=`attack${combo}` as PlayerState;p.stateTime=0;this.emit('sword');
  }
  damageEnemy(e:Enemy,amount:number):void{
    if(e.hp<=0||!Number.isFinite(amount)||amount<=0)return;
    const damage=Math.min(e.hp,amount);e.hp-=damage;e.hurt=.28;
    // A brief reaction pauses ordinary enemies without resetting their attack
    // telegraph. The Guardian keeps its attack rhythm.
    if(e.kind!=='guardian')e.stagger=amount>1?.24:.12;
    this.events.push({type:'hit',enemyId:e.id,damage,strong:amount>1,x:e.x,y:e.y+.65,z:e.z});
    if(e.hp===0){
      e.state='dead';e.timer=0;
      this.emit('enemy-death',undefined,e);
      if(e.id===this.targetId)this.targetId=null;
      if(e.kind==='guardian'){this.save.bossDefeated=true;this.emit('guardian-cleared','El Guardián descansa. Sigue la luz hasta el altar y devuelve la vida al santuario.');}
      else{this.save.defeatedOrdinaryEnemies.push(e.id as OrdinaryEnemyId);this.player.health=Math.min(10,this.player.health+1);}
      if(e.kind==='spirit'){
        this.projectiles=this.projectiles.filter(b=>b.ownerId!==e.id);
        this.emit('spirit-cleared','El Espíritu descansa. Sigue la luz hasta el interruptor de las ruinas.');
      }
      this.persist();
    }
  }
  receiveDamage(amount:number,source:V2,blockable=true):'ignored'|'blocked'|'hurt'{
    const p=this.player;
    if(this.mode!=='playing'||p.invulnerable>0||(p.state==='roll'&&p.stateTime<.25))return 'ignored';
    if(blockable&&p.shield&&shieldBlocks(p,p.yaw,source)){this.emit('shield',undefined,p);return 'blocked';}
    p.health=Math.max(0,p.health-amount);p.invulnerable=.7;p.state='hurt';p.stateTime=0;p.attackTime=-1;p.attackBuffer=0;p.queued=false;p.combo=0;p.shield=false;this.emit('hurt',undefined,p);
    if(p.health===0){p.state='death';this.mode='dead';this.modeTime=0;this.save.deaths++;this.emit('death');this.persist();}
    return 'hurt';
  }
  private updateEnemy(e:Enemy,dt:number):void{
    e.age+=dt;e.hurt=Math.max(0,e.hurt-dt);
    if(e.hp<=0){e.timer+=dt;return;}
    if(e.stagger>0){e.stagger=Math.max(0,e.stagger-dt);return;}
    e.timer+=dt;
    const p=this.player,d=distance(e,p);
    if(e.kind==='guardian'&&(!this.save.doorUnlocked||p.z<94)){
      e.state='idle';e.timer=0;e.hit=false;e.attackIndex=0;return;
    }
    const detect=e.kind==='guardian'?24:e.kind==='spirit'?12:10;
    if(e.state==='idle'||e.state==='patrol'){
      if(d<detect){e.state='chase';e.timer=0;}
      else if(e.kind==='sprout'){e.state='patrol';const goal={x:e.home.x+Math.sin(e.age*.4)*1.6,z:e.home.z+Math.cos(e.age*.4)*1.3};this.moveEnemy(e,goal,.5,dt);return;}
      else return;
    }
    if(e.state==='chase'){
      e.yaw=angleTo(e,p);
      if(e.kind==='spirit'){
        if(d<4)this.moveEnemy(e,{x:e.x+(e.x-p.x),z:e.z+(e.z-p.z)},.8,dt);else if(d>spiritCombat.preferredRange)this.moveEnemy(e,p,1.2,dt);
        // Retreat changes movement direction, but the mask must keep facing Ruen.
        e.yaw=angleTo(e,p);
        if(!this.visibleEnemy(e))e.timer=0;
        else if(e.timer>spiritCombat.approachTime&&d<12){e.state='windup';e.timer=0;e.aim={x:p.x,z:p.z};this.emit('spirit-charge',undefined,e);}
      }else{
        const reach=e.kind==='guardian'?3.5:2.9;
        if(d>reach)this.moveEnemy(e,p,e.kind==='guardian'?1.3:1.9,dt);
        else if((e.kind!=='guardian'||this.visibleEnemy(e))&&(e.kind!=='sprout'||(this.sproutAttackCooldown===0&&!this.enemies.some(other=>other!==e&&other.kind==='sprout'&&other.hp>0&&(other.state==='windup'||other.state==='attack'))))){
          e.state='windup';e.timer=0;e.hit=false;e.aim={x:p.x,z:p.z};
          this.emit(e.kind==='guardian'?`guardian-${guardianAttack(e.attackIndex).kind}-charge`:'telegraph',undefined,e);
        }
      }
    }else if(e.state==='windup'){
      const windup=e.kind==='guardian'?guardianAttack(e.attackIndex).windup:e.kind==='spirit'?spiritCombat.windup:.75;
      const lock=e.kind==='guardian'?guardianAttack(e.attackIndex).aimLock:e.kind==='spirit'?spiritCombat.aimLockTime:windup*.55;
      if(e.timer<lock){e.aim={x:p.x,z:p.z};e.yaw=angleTo(e,e.aim);}
      if(e.timer>=windup){e.state='attack';e.timer=0;e.hit=false;
        if(e.kind==='spirit'){
          const yaw=angleTo(e,e.aim),dx=Math.sin(yaw),dz=Math.cos(yaw),y=groundHeight(e.x,e.z)+spiritCombat.projectileHeight;
          const muzzle={x:e.x+dx*spiritCombat.muzzleOffset,y,z:e.z+dz*spiritCombat.muzzleOffset};
          if(clearMeleePath({...e,y},muzzle,this.save))this.projectiles.push({id:++this.projectileId,ownerId:e.id,...muzzle,vx:dx*spiritCombat.projectileSpeed,vz:dz*spiritCombat.projectileSpeed,life:spiritCombat.projectileLife});
          this.emit('projectile');
        }
      }
    }else if(e.state==='attack'){
      if(e.kind==='sprout'){
        const next=moveWithCollisions(e,Math.sin(e.yaw)*7*dt,Math.cos(e.yaw)*7*dt,e.radius,e.y,this.save);e.x=next.x;e.z=next.z;
        if(!e.hit&&distance(e,p)<e.radius+.6&&p.y-e.y<.9){
          const result=this.receiveDamage(1,e);e.hit=true;
          if(result==='blocked'){e.state='recover';e.timer=0;this.sproutAttackCooldown=.35;}
        }
      }else if(e.kind==='guardian'&&!e.hit){
        const attack=guardianAttack(e.attackIndex);
        if(e.timer>=attack.impact){
          this.emit(`guardian-${attack.kind}-impact`,undefined,e);
          if(guardianHits(e,p)&&this.visibleEnemy(e)){
            const result=this.receiveDamage(guardianCombat.damage,e,attack.blockable);
            if(result==='blocked')this.emit('guardian-block');
            else if(result==='ignored'&&p.state==='roll'&&p.stateTime<config.combat.dodgeInvulnerability)this.emit('guardian-dodge');
          }
          e.hit=true;
        }
      }
      if(e.timer>(e.kind==='guardian'?guardianAttack(e.attackIndex).release:e.kind==='spirit'?spiritCombat.releaseTime:.4)){e.state='recover';e.timer=0;if(e.kind==='sprout')this.sproutAttackCooldown=.35;}
    }else if(e.state==='recover'&&e.timer>(e.kind==='guardian'?guardianAttack(e.attackIndex).recovery:e.kind==='spirit'?spiritCombat.recovery:1.1)){e.state='chase';e.timer=0;e.attackIndex++;}
    e.y=groundHeight(e.x,e.z)+(e.kind==='spirit'?.7:0);
  }
  private moveEnemy(e:Enemy,to:V2,speed:number,dt:number):void{
    const yaw=angleTo(e,to);e.yaw=yaw;const n=moveWithCollisions(e,Math.sin(yaw)*speed*dt,Math.cos(yaw)*speed*dt,e.radius,e.y,this.save);
    e.x=clamp(n.x,e.home.x-8,e.home.x+8);e.z=clamp(n.z,e.home.z-9,e.home.z+9);
  }
  private updateProjectiles(dt:number):void{
    const p=this.player;
    this.projectiles=this.projectiles.filter(b=>{
      b.life-=dt;if(b.life<=0)return false;
      const old={x:b.x,y:b.y,z:b.z},next={x:b.x+b.vx*dt,y:b.y,z:b.z+b.vz*dt},r=spiritCombat.projectileRadius;
      const wall=firstSolidHit(old,next,this.save,r);
      const playerHit=b.y>=p.y-r&&b.y<=p.y+config.player.height+r?segmentCircleEntry(old,next,p,.28+r):undefined;
      if(wall!==undefined&&(playerHit===undefined||wall<=playerHit)){
        this.events.push({type:'magic-impact',x:old.x+(next.x-old.x)*wall,y:b.y,z:old.z+(next.z-old.z)*wall});return false;
      }
      if(playerHit!==undefined){
        const result=this.receiveDamage(1,{x:p.x-b.vx,z:p.z-b.vz});
        if(result==='blocked')this.emit('magic-block');
        else if(result==='ignored'&&p.state==='roll'&&p.stateTime<config.combat.dodgeInvulnerability)this.emit('magic-dodge');
        return false;
      }
      b.x=next.x;b.z=next.z;
      if(Math.abs(b.x)>14||b.z< -10||b.z>132||b.y-r<=groundHeight(b.x,b.z))return false;
      return true;
    });
  }
  interaction():{id:InteractionId;label:string}|null{
    const p=this.player;
    for(const [id,pos]of Object.entries(interactables))if(distance(p,pos)<2.2){
      const key=id as InteractionId;
      if(key==='ruins-switch'&&!this.save.switchActivated)return{id:key,label:this.save.defeatedOrdinaryEnemies.includes('spirit-1')?'Activar interruptor':'Derrota al Espíritu errante'};
      if(key==='key-chest'&&!this.save.chestOpened)return{id:key,label:'Abrir cofre'};
      if(key==='sanctuary-door'&&!this.save.doorUnlocked)return{id:key,label:this.save.hasKey?'Abrir el santuario':'Necesitas la llave del santuario'};
      if(key==='restoration-altar'&&!this.save.altarActivated)return{id:key,label:this.save.bossDefeated?'Restaurar el santuario':'El Guardián protege este altar'};
    }return null;
  }
  interact():boolean{
    if(this.mode!=='playing'||this.player.attackTime>=0||this.player.state==='roll')return false;
    const target=this.interaction();if(!target)return false;const s=this.save;
    if(target.id==='ruins-switch'){
      if(!s.defeatedOrdinaryEnemies.includes('spirit-1')){this.emit('message','La magia del Espíritu mantiene sellado el interruptor.');return false;}
      s.switchActivated=true;s.grateOpened=true;this.emit('switch','La reja se ha abierto. Busca el cofre.');
    }else if(target.id==='key-chest'){
      if(!s.grateOpened||this.player.x<7||this.player.z<57.5)return false;s.chestOpened=true;s.hasKey=true;this.emit('chest','Llave del santuario obtenida');
    }else if(target.id==='sanctuary-door'){
      if(!s.hasKey){this.emit('message','Encuentra la llave en el Patio de las ruinas.');return false;}
      s.doorUnlocked=true;this.checkpoint('before-guardian');this.emit('door','El santuario se abre. El Guardián te espera.');
    }else{
      if(!s.bossDefeated)return false;s.altarActivated=true;s.completed=true;this.mode='restoring';this.modeTime=0;
      this.player.state='victory';this.player.stateTime=0;this.player.shield=false;
      this.player.vx=this.player.vz=this.player.vy=0;this.player.y=groundHeight(this.player.x,this.player.z);
      this.player.yaw=angleTo(this.player,interactables['restoration-altar']);this.targetId=null;this.emit('restore');
    }
    if(this.mode==='playing'){this.player.state='interact';this.player.stateTime=0;}this.persist();return true;
  }
  private checkpoint(id:'after-sprouts'|'before-guardian'):void{
    if(this.save.checkpoint===id)return;this.save.checkpoint=id;this.player.health=10;this.emit('checkpoint',id==='after-sprouts'?'Recuerdo del sendero · punto de control':'Umbral del santuario · punto de control');this.persist();
  }
  private updateProgress():void{
    const both=this.save.defeatedOrdinaryEnemies.includes('sprout-1')&&this.save.defeatedOrdinaryEnemies.includes('sprout-2');
    if(both&&this.save.checkpoint==='start')this.checkpoint('after-sprouts');
    const zone=zoneAt(this.player.z),index=zones.indexOf(zone);
    if(zone.id!==this.zone){this.zone=zone.id;this.emit('zone',zone.name);}
    if(index>zones.findIndex(z=>z.id===this.save.reachedZone)){this.save.reachedZone=zone.id;this.persist();}
  }
  respawn():void{
    if(this.mode==='restoring'||this.mode==='won')return;
    this.player=this.makePlayer();this.targetId=null;this.lostTargetTime=0;this.sproutAttackCooldown=0;this.projectiles=[];this.mode='playing';this.modeTime=0;
    this.zone=zoneAt(this.player.z).id;
    for(const e of this.enemies)if(e.hp>0){e.x=e.home.x;e.z=e.home.z;e.y=groundHeight(e.x,e.z)+(e.kind==='spirit'?.7:0);e.hp=e.maxHp;e.state='idle';e.timer=0;e.attackIndex=0;e.hit=false;e.hurt=0;e.stagger=0;}
    this.emit('respawn');this.persist();
  }
  objective():string{
    if(this.save.completed)return 'Santuario restaurado';
    if(this.save.bossDefeated)return 'Activa el altar del santuario';
    if(this.save.doorUnlocked)return 'Derrota al Guardián ancestral';
    if(this.save.hasKey)return 'Abre la puerta del santuario';
    if(this.save.grateOpened)return 'Abre el cofre y recoge la llave';
    if(this.save.defeatedOrdinaryEnemies.includes('spirit-1'))return 'Activa el interruptor de las ruinas';
    if(this.save.checkpoint!=='start')return 'Derrota al Espíritu errante';
    if(this.player.z>16)return 'Derrota a las criaturas del sendero';
    return 'Explora el bosque';
  }
  objectivePosition():V2{
    if(this.save.bossDefeated)return interactables['restoration-altar'];
    if(this.save.doorUnlocked)return this.enemies[3]!;
    if(this.save.hasKey)return interactables['sanctuary-door'];
    if(this.save.grateOpened)return interactables['key-chest'];
    if(this.save.defeatedOrdinaryEnemies.includes('spirit-1'))return interactables['ruins-switch'];
    return this.enemies.find(e=>e.hp>0)??interactables['restoration-altar'];
  }
  guidancePosition():V2{
    const goal=this.objectivePosition();
    return this.save.grateOpened&&this.player.z>48&&this.player.z<73
      ?ruinsWaypoint(this.player,goal,this.save):goal;
  }
}
