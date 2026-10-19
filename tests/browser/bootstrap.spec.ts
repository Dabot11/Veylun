import { test, expect } from '@playwright/test';
import { freshSave, SAVE_KEY } from '../../src/progression/save';
// Pause through the public control before capturing the canvas: continuous
// software rendering can starve full-resolution screenshot readback.
test.setTimeout(180000);
test('new game, keyboard movement, jump, roll, camera, pause and responsive HUD',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('pointer lock'))errors.push(m.text());});
 await page.goto('/');await expect(page.locator('body')).toHaveAttribute('data-engine','ready',{timeout:60000});
 await page.getByRole('button',{name:'Nueva partida'}).click();await expect(page.locator('body')).toHaveAttribute('data-screen','none');
 await expect(page.locator('#health')).toHaveAttribute('aria-label','Salud: 10 de 10');
 await page.keyboard.press('Escape');await expect(page.getByRole('heading',{name:'Pausa'})).toBeVisible();
 const before=await page.locator('canvas').screenshot({path:'test-results/awakening.png'});
 await page.getByRole('button',{name:'Continuar',exact:true}).click();
 await page.keyboard.down('KeyW');await page.waitForTimeout(1500);await page.keyboard.press('Space');await page.waitForTimeout(600);await page.keyboard.press('ShiftLeft');await page.waitForTimeout(500);await page.keyboard.up('KeyW');
 await page.keyboard.press('Escape');await expect(page.getByRole('heading',{name:'Pausa'})).toBeVisible();
 expect((await page.locator('canvas').screenshot()).equals(before)).toBe(false);
 await page.getByRole('button',{name:'Continuar',exact:true}).click();
 await page.mouse.move(800,380);await page.mouse.move(960,400,{steps:10});
 await page.keyboard.press('Escape');await expect(page.getByRole('heading',{name:'Pausa'})).toBeVisible();
 await page.getByRole('button',{name:'Ajustes'}).click();await expect(page.getByLabel('Volumen')).toBeVisible();await page.getByLabel('Sombras').uncheck();await page.getByRole('button',{name:'Volver',exact:true}).click();
 await page.getByRole('button',{name:'Controles',exact:true}).click();await expect(page.locator('.control-table')).toContainText('RT');await page.getByRole('button',{name:'Volver',exact:true}).click();
 await page.getByRole('button',{name:'Continuar',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await expect(page.locator('canvas')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(errors).toEqual([]);
});
test('corrupt saves are handled without crashing or enabling Continue',async({page})=>{
 await page.addInitScript(key=>localStorage.setItem(key,'broken-json'),SAVE_KEY);await page.goto('/');await expect(page.locator('body')).toHaveAttribute('data-engine','ready',{timeout:60000});
 await expect(page.getByRole('button',{name:'Continuar aventura'})).toHaveCount(0);await expect(page.locator('#save-warning')).toContainText('dañado');
 await page.getByRole('button',{name:'Nueva partida'}).click();await expect(page.locator('body')).toHaveAttribute('data-screen','none');
});
test('saved checkpoint, key and boss completion persist; new game requires confirmation',async({page})=>{
 const save=freshSave();Object.assign(save,{checkpoint:'before-guardian',hasKey:true,chestOpened:true,switchActivated:true,grateOpened:true,doorUnlocked:true,defeatedOrdinaryEnemies:['sprout-1','sprout-2','spirit-1'],bossDefeated:true});
 await page.addInitScript(({key,save})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(save));},{key:SAVE_KEY,save});
 await page.goto('/');await expect(page.locator('body')).toHaveAttribute('data-engine','ready',{timeout:60000});await page.getByRole('button',{name:'Continuar aventura'}).click();await expect(page.locator('#objective p')).toHaveText('Activa el altar del santuario');
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Reiniciar partida'}).click();await page.getByRole('button',{name:'Conservar partida'}).click();await expect(page.getByRole('heading',{name:'Pausa'})).toBeVisible();
 await page.reload();await expect(page.locator('body')).toHaveAttribute('data-engine','ready',{timeout:60000});await page.getByRole('button',{name:'Continuar aventura'}).click();await expect(page.locator('#objective small')).toContainText('Llave');
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Reiniciar partida'}).click();await page.getByRole('button',{name:'Borrar y comenzar'}).click();await expect(page.locator('#objective p')).toHaveText('Explora el bosque');
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),SAVE_KEY);expect(saved.hasKey).toBe(false);expect(saved.checkpoint).toBe('start');
});
test('synthetic standard Xbox is detected, starts game, moves and pauses on a single edge',async({page})=>{
 await page.addInitScript(()=>{
  const pad={id:'Xbox simulated for automated testing',index:0,connected:true,mapping:'standard',timestamp:0,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,touched:false,value:0}))};
  Object.assign(window,{testPad:pad});Object.defineProperty(navigator,'getGamepads',{value:()=>[pad]});
 });
 await page.goto('/');await expect(page.locator('body')).toHaveAttribute('data-engine','ready',{timeout:60000});
 async function press(index:number){await page.evaluate(i=>{const p=(window as unknown as {testPad:{buttons:{pressed:boolean;value:number}[]}}).testPad;p.buttons[i]!.pressed=true;p.buttons[i]!.value=1;},index);await page.waitForTimeout(350);await page.evaluate(i=>{const p=(window as unknown as {testPad:{buttons:{pressed:boolean;value:number}[]}}).testPad;p.buttons[i]!.pressed=false;p.buttons[i]!.value=0;},index);await page.waitForTimeout(250);}
 await press(0);await expect(page.locator('body')).toHaveAttribute('data-screen','none');await expect(page.locator('#controls-hint')).toContainText('LT');
 await page.evaluate(()=>{(window as unknown as {testPad:{axes:number[]}}).testPad.axes[1]=-1;});await page.waitForTimeout(1000);await press(0);await press(1);await press(2);
 await page.evaluate(()=>{(window as unknown as {testPad:{axes:number[]}}).testPad.axes[1]=0;});await press(9);await expect(page.getByRole('heading',{name:'Pausa'})).toBeVisible();await page.waitForTimeout(500);await expect(page.getByRole('heading',{name:'Pausa'})).toBeVisible();
 await page.evaluate(()=>{(window as unknown as {testPad:{connected:boolean}}).testPad.connected=false;window.dispatchEvent(new Event('gamepaddisconnected'));});await page.getByRole('button',{name:'Controles',exact:true}).click();await page.locator('summary').click();await expect(page.locator('#pad-diagnostic')).toContainText('Sin mando');
});
