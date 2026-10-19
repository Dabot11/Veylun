import { describe,it,expect } from 'vitest';
import { Simulation, type Commands } from '../../src/core/Simulation';
import { groundHeight,moveWithCollisions,checkpoints } from '../../src/world/level';
import { freshSave,parseSave,SaveStore,SAVE_KEY } from '../../src/progression/save';
import { distance,angleTo } from '../../src/core/math';
import { radialDeadzone } from '../../src/input/InputManager';
const idle:Commands={x:0,z:0};
function advance(g:Simulation,seconds:number,input:Commands=idle){for(let i=0;i<Math.round(seconds*60);i++)g.step(1/60,{...input,jump:i===0&&!!input.jump,dodge:i===0&&!!input.dodge,attack:i===0&&!!input.attack});}
function place(g:Simulation,x:number,z:number){g.player.x=x;g.player.z=z;g.player.y=groundHeight(x,z);g.player.vx=g.player.vz=0;}
function unlocked(){const s=freshSave();s.defeatedOrdinaryEnemies=['sprout-1','sprout-2','spirit-1'];s.checkpoint='after-sprouts';s.hasKey=s.chestOpened=s.switchActivated=s.grateOpened=s.doorUnlocked=true;return s;}
describe('movement and defensive combat',()=>{
 it('accelerates, moves and decelerates independently from rendering',()=>{const g=new Simulation();advance(g,1,{x:1,z:0});expect(g.player.x).toBeGreaterThan(3);advance(g,1);expect(Math.abs(g.player.vx)).toBeLessThan(.001);});
 it('jumps once, refuses an air jump and returns to ground',()=>{const g=new Simulation();advance(g,.2,{...idle,jump:true});const vy=g.player.vy;g.step(1/60,{...idle,jump:true});expect(g.player.vy).toBeLessThan(vy);advance(g,1);expect(g.player.grounded).toBe(true);expect(g.player.y).toBeCloseTo(groundHeight(g.player.x,g.player.z));});
 it('buffers a jump before landing and restores invalid falls at the checkpoint',()=>{const g=new Simulation();g.player.grounded=false;g.player.coyote=0;g.player.y=.01;g.player.vy=-1;g.step(1/60,{...idle,jump:true});g.step(1/60,idle);expect(g.player.vy).toBeGreaterThan(0);g.player.y=-25;g.step(1/60,idle);expect(g.player.z).toBe(0);expect(g.player.y).toBe(0);});
 it('blocks closed doors, cage walls and the first combat seal even during long movement',()=>{const s=freshSave();expect(moveWithCollisions({x:0,z:88},0,8,.28,0,s).z).toBeLessThan(90);expect(moveWithCollisions({x:10,z:55},0,8,.28,0,s).z).toBeLessThan(57);expect(moveWithCollisions({x:0,z:39},0,8,.28,0,s).z).toBeLessThan(41);});
 it('does not permit walking through an ordinary tree',()=>{const g=new Simulation();const p=moveWithCollisions({x:10.5,z:-10},0,5,.28,0,g.save);expect(p.z).toBeLessThan(-7);});
 it('blocks frontal hits, accepts rear hits and cannot block ground shockwaves',()=>{const g=new Simulation();g.player.shield=true;expect(g.receiveDamage(1,{x:0,z:2})).toBe('blocked');expect(g.player.health).toBe(10);expect(g.receiveDamage(1,{x:0,z:-2})).toBe('hurt');g.player.invulnerable=0;g.player.shield=true;expect(g.receiveDamage(2,{x:0,z:2},false)).toBe('hurt');expect(g.player.health).toBe(7);});
 it('has a bounded roll invulnerability window and cooldown',()=>{const g=new Simulation();g.step(1/60,{x:0,z:1,dodge:true});expect(g.receiveDamage(2,{x:0,z:3})).toBe('ignored');advance(g,.3);expect(g.receiveDamage(1,{x:0,z:3})).toBe('hurt');g.step(1/60,{...idle,dodge:true});expect(g.player.state).not.toBe('roll');});
 it('locks, cycles and releases targets, then clears a dead target',()=>{const g=new Simulation();place(g,0,29);g.selectTarget();const first=g.targetId;expect(first).not.toBeNull();g.selectTarget(1);expect(g.targetId).not.toBe(first);g.selectTarget();expect(g.targetId).toBeNull();g.selectTarget();g.damageEnemy(g.target!,99);expect(g.targetId).toBeNull();});
 it('caps a chain at three strikes with bounded recovery',()=>{const g=new Simulation();const observed:number[]=[];for(let i=0;i<100;i++){g.step(1/60,{...idle,attack:[0,12,40].includes(i)});observed.push(g.player.combo);}expect(Math.max(...observed)).toBe(3);advance(g,1);expect(g.player.attackTime).toBe(-1);});
 it('hits once per active window and requires facing and vertical overlap',()=>{const g=new Simulation();const e=g.enemies[0]!;place(g,e.x,e.z-1.3);g.player.yaw=0;advance(g,.3,{...idle,attack:true});expect(e.hp).toBe(2);advance(g,.3);place(g,e.x,e.z-1.3);g.player.yaw=Math.PI;advance(g,.4,{...idle,attack:true});expect(e.hp).toBe(2);});
});
describe('enemy state machines',()=>{
 it.each(['sprout','spirit','guardian'] as const)('%s can receive lethal damage and no longer attacks',kind=>{const g=new Simulation(unlocked()),e=g.enemies.find(e=>e.kind===kind)!;e.hp=e.maxHp;e.state='chase';g.damageEnemy(e,99);place(g,e.x,e.z-1);const health=g.player.health;advance(g,5);expect(e.state).toBe('dead');expect(g.player.health).toBe(health);});
 it('a sprout charge can damage the player',()=>{const g=new Simulation(),e=g.enemies[0]!;place(g,e.x,e.z-2);advance(g,2.2);expect(g.player.health).toBeLessThan(10);});
 it('a spirit emits moving projectiles that damage the player and expire',()=>{const g=new Simulation(),e=g.enemies[2]!;place(g,e.x,e.z-5);advance(g,2.5);expect(g.projectiles.length).toBeGreaterThan(0);advance(g,2);expect(g.player.health).toBeLessThan(10);place(g,0,0);advance(g,7);expect(g.projectiles.length).toBe(0);});
 it('spirit projectiles are blocked by a frontal shield',()=>{const g=new Simulation();place(g,-2,51);g.player.yaw=0;advance(g,5,{...idle,shield:true});expect(g.player.health).toBe(10);expect(g.events.some(e=>e.type==='shield')).toBe(true);});
 it('the guardian alternates frontal and area attacks with telegraphs and recovery',()=>{const g=new Simulation(unlocked());place(g,0,111.3);const e=g.enemies[3]!;const seen=new Set<string>();for(let i=0;i<600;i++){g.player.health=10;g.step(1/60,idle);seen.add(`${e.state}-${e.attackIndex%2}`);}expect(seen.has('windup-0')).toBe(true);expect(seen.has('attack-1')).toBe(true);expect(seen.has('recover-1')).toBe(true);expect(g.events.some(e=>e.type==='hurt')).toBe(true);});
});
describe('progression, death and persistence',()=>{
 it('activates checkpoint 1 only after both sprouts die',()=>{const g=new Simulation();g.damageEnemy(g.enemies[0]!,3);advance(g,.1);expect(g.save.checkpoint).toBe('start');g.damageEnemy(g.enemies[1]!,3);advance(g,.1);expect(g.save.checkpoint).toBe('after-sprouts');});
 it('requires spirit → switch → grate → chest → key → explicit door interaction',()=>{const g=new Simulation();place(g,-4,60);expect(g.interact()).toBe(false);place(g,10,61);expect(g.interact()).toBe(false);place(g,0,88);expect(g.interact()).toBe(false);g.damageEnemy(g.enemies[0]!,3);g.damageEnemy(g.enemies[1]!,3);advance(g,.1);g.damageEnemy(g.enemies[2]!,2);place(g,-4,60);expect(g.interact()).toBe(true);expect(g.save.grateOpened).toBe(true);place(g,10,61);expect(g.interact()).toBe(true);expect(g.save.hasKey).toBe(true);place(g,0,88);advance(g,.5);expect(g.save.doorUnlocked).toBe(false);expect(g.interact()).toBe(true);expect(g.save.checkpoint).toBe('before-guardian');});
 it('restores health, position, camera reset event and progress on death; resets boss',()=>{const s=unlocked();s.checkpoint='before-guardian';const g=new Simulation(s);place(g,0,112);g.enemies[3]!.hp=3;g.player.health=1;g.receiveDamage(2,{x:0,z:114});advance(g,1.8);expect(g.player.health).toBe(10);expect(g.player.x).toBe(checkpoints['before-guardian'].x);expect(g.player.z).toBeCloseTo(85);expect(g.enemies[3]!.hp).toBe(12);expect(g.save.hasKey&&g.save.chestOpened&&g.save.doorUnlocked).toBe(true);expect(g.save.deaths).toBe(1);expect(g.enemies.slice(0,3).every(e=>e.hp===0)).toBe(true);expect(g.events.some(e=>e.type==='respawn')).toBe(true);});
 it('does not win on boss death or altar proximity; requires interaction and restoration',()=>{const g=new Simulation(unlocked());place(g,0,126);expect(g.interact()).toBe(false);g.damageEnemy(g.enemies[3]!,12);advance(g,.2);expect(g.mode).toBe('playing');expect(g.save.completed).toBe(false);expect(g.interact()).toBe(true);expect(g.mode).toBe('restoring');advance(g,3.1);expect(g.mode).toBe('won');expect(g.save.completed).toBe(true);});
 it('roundtrips a valid save and rejects corrupt, inconsistent or future data',()=>{const s=unlocked();expect(parseSave(JSON.stringify(s))).toEqual(s);for(const raw of ['nope','null','{}',JSON.stringify({...s,version:99}),JSON.stringify({...freshSave(),completed:true}),JSON.stringify({...s,deaths:-1}),JSON.stringify({...s,hasKey:false})])expect(parseSave(raw)).toBeNull();});
 it('handles storage failures without breaking a running game',()=>{const store=new SaveStore({getItem:()=>{throw Error();},setItem:()=>{throw Error();},removeItem:()=>{throw Error();}});expect(store.read()).toBeNull();store.write(freshSave());store.clear();expect(store.warning).not.toBe('');});
 it('loads the same progress into a new simulation',()=>{const values=new Map<string,string>();const store=new SaveStore({getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v)},removeItem:k=>{values.delete(k)}});const s=unlocked();s.checkpoint='before-guardian';store.write(s);expect(values.has(SAVE_KEY)).toBe(true);const g=new Simulation(store.read()!);expect(g.player.z).toBe(85);expect(g.save.hasKey).toBe(true);store.clear();expect(store.read()).toBeNull();});
 it('maps analog deadzone smoothly and preserves diagonal magnitude',()=>{expect(radialDeadzone(.1,.1,.18)).toEqual({x:0,y:0});const v=radialDeadzone(1,1,.18);expect(Math.hypot(v.x,v.y)).toBeCloseTo(1);expect(radialDeadzone(.5,0,.18).x).toBeGreaterThan(0);});
});
describe('complete level through actual simulation commands',()=>{
 it('walks, fights, solves the puzzle and restores the sanctuary',()=>{
  const g=new Simulation();let ticks=0;
  function tick(input:Commands){g.step(1/60,input);g.events=[];ticks++;expect(g.mode).not.toBe('dead');}
  function go(x:number,z:number){for(let i=0;i<5000&&distance(g.player,{x,z})>.5;i++){const a=angleTo(g.player,{x,z});tick({x:Math.sin(a),z:Math.cos(a)});}expect(distance(g.player,{x,z})).toBeLessThan(.6);}
  function fight(index:number){const e=g.enemies[index]!;for(let i=0;i<15000&&e.hp>0;i++){
    const a=angleTo(g.player,e),d=distance(g.player,e);g.targetId=e.id;
    const slam=e.kind==='guardian'&&e.attackIndex%2===1&&(e.state==='windup'||e.state==='attack');
    const approach=slam?-1:d>(e.kind==='guardian'?2.2:1.25)?1:0;
    tick({x:Math.sin(a)*approach,z:Math.cos(a)*approach,attack:i%14===0&&!slam,shield:e.state==='windup'&&!slam,dodge:slam&&e.timer>.7});
  }expect(e.hp).toBe(0);}
  go(0,20);fight(0);fight(1);go(0,48);fight(2);go(-4,60);tick({...idle,interact:true});expect(g.save.grateOpened).toBe(true);
  go(3,51);go(10,51);go(10,61);tick({...idle,interact:true});expect(g.save.hasKey).toBe(true);
  go(10,51);go(3,51);go(0,87.7);tick({...idle,interact:true});expect(g.save.doorUnlocked).toBe(true);
  go(0,103);fight(3);expect(g.save.completed).toBe(false);go(0,125);tick({...idle,interact:true});advance(g,3.1);expect(g.mode).toBe('won');expect(parseSave(JSON.stringify(g.save))).not.toBeNull();expect(ticks).toBeGreaterThan(600);
 },20000);
});
