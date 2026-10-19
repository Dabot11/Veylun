import { test, expect as baseExpect } from '@playwright/test';
import './harness';
const expect=baseExpect.configure({timeout:30000});
test.use({baseURL:'http://127.0.0.1:5174',viewport:{width:640,height:480}});
test.setTimeout(300000);
test('rendered gameplay responds to controls and victory requires the altar interaction',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/?test=1');await expect(page.locator('body')).toHaveAttribute('data-engine','ready',{timeout:60000});
 // A key arriving in the same event turn as Start must survive until the first
 // gameplay frame, rather than being discarded using the previous menu state.
 await page.evaluate(()=>document.addEventListener('click',()=>window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',bubbles:true})),{once:true}));
 await page.getByRole('button',{name:'Nueva partida'}).click();
 await page.keyboard.down('KeyW');await expect.poll(()=>page.evaluate(()=>window.__veylun.sim.player.z)).toBeGreaterThan(1);await page.keyboard.up('KeyW');
 const z=await page.evaluate(()=>window.__veylun.sim.player.z);const cameraZ=await page.evaluate(()=>window.__veylun.camera.camera.position.z);expect(cameraZ).toBeLessThan(z);
 await page.keyboard.press('Space');await expect.poll(()=>page.evaluate(()=>window.__veylun.sim.player.y)).toBeGreaterThan(.2);
 await page.keyboard.down('KeyK');await expect.poll(()=>page.evaluate(()=>window.__veylun.sim.player.shield)).toBe(true);await page.keyboard.up('KeyK');
 // Controlled QA fixture: place Ruen before a living enemy, without changing the input adapter.
 await page.evaluate(()=>{const g=window.__veylun.sim;g.player.x=-2;g.player.z=26;g.player.y=0;g.player.vx=g.player.vz=g.player.vy=0;});
 await page.keyboard.press('KeyQ');await expect.poll(()=>page.evaluate(()=>window.__veylun.sim.targetId)).not.toBeNull();await page.keyboard.press('KeyQ');await expect.poll(()=>page.evaluate(()=>window.__veylun.sim.targetId)).toBeNull();
 // A seeded late-game fixture tests the rendered boss and exact win gate. The pure
 // simulation suite separately traverses the entire level without granted progress.
 await page.evaluate(()=>{
  const g=window.__veylun.sim;Object.assign(g.save,{checkpoint:'before-guardian',reachedZone:'guardian',hasKey:true,chestOpened:true,switchActivated:true,grateOpened:true,doorUnlocked:true,defeatedOrdinaryEnemies:['sprout-1','sprout-2','spirit-1']});
  for(const e of g.enemies.slice(0,3)){e.hp=0;e.state='dead';}
  Object.assign(g.player,{x:0,z:110,y:.6,health:10,vx:0,vz:0,vy:0,attackTime:-1,state:'idle'});window.__veylun.camera.reset(g);
 });
 await expect(page.locator('#boss')).toBeVisible();await page.screenshot({path:'test-results/guardian.png'});
 await page.evaluate(()=>{const g=window.__veylun.sim;Object.assign(g.player,{x:0,z:125,y:.6,vx:0,vz:0});window.__veylun.camera.reset(g);});
 await page.keyboard.press('KeyE');await expect.poll(()=>page.evaluate(()=>window.__veylun.sim.mode)).toBe('playing');await expect(page.getByRole('heading',{name:'Santuario restaurado'})).toHaveCount(0);
 await page.evaluate(()=>{const g=window.__veylun.sim;g.damageEnemy(g.enemies[3]!,12);});
 await expect(page.locator('#objective p')).toHaveText('Activa el altar del santuario');await expect(page.getByRole('heading',{name:'Santuario restaurado'})).toHaveCount(0);
 // The ceremony lasts three simulation seconds; the fixed-step clock caps
 // elapsed time per software-rendered frame, so wall time can be much longer.
 await page.keyboard.press('KeyE');await expect.poll(()=>page.evaluate(()=>window.__veylun.sim.mode),{timeout:90000}).toBe('won');
 await expect(page.getByRole('heading',{name:'Santuario restaurado'})).toBeVisible();await page.screenshot({path:'test-results/victory.png'});expect(errors).toEqual([]);
});
