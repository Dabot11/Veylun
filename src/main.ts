import './ui/styles.css';
import { Application } from './core/Application';
const canvas=document.querySelector<HTMLCanvasElement>('#renderCanvas')!;
let app:Application|undefined;
try{app=new Application(canvas);app.start();}
catch(error){document.querySelector('#loading')?.remove();const panel=document.querySelector<HTMLElement>('#error')!;panel.hidden=false;panel.textContent='No fue posible iniciar el bosque. Activa la aceleración gráfica de Chrome y recarga la página.';document.body.dataset['engine']='error';console.error(error);}
import.meta.hot?.dispose(()=>app?.dispose());
