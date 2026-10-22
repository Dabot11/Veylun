import './ui/styles.css';
const canvas=document.querySelector<HTMLCanvasElement>('#renderCanvas')!;
let app:{start():void;dispose():void}|undefined;
let disposed=false;
async function start():Promise<void>{
 try{
  // The inspector never creates the simulation, input manager or save store.
  const inspect=new URLSearchParams(location.search).get('inspect')==='ruen';
  const App=inspect?(await import('./inspection/AssetInspector')).AssetInspector:(await import('./core/Application')).Application;
  if(disposed)return;
  app=new App(canvas);app.start();
 }catch(error){document.querySelector('#loading')?.remove();const panel=document.querySelector<HTMLElement>('#error')!;panel.hidden=false;panel.textContent='No fue posible iniciar la escena. Activa la aceleración gráfica de Chrome y recarga la página.';document.body.dataset['engine']='error';console.error(error);}
}
void start();
import.meta.hot?.dispose(()=>{disposed=true;app?.dispose();});
