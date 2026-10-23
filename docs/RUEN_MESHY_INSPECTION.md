# Ruen / Meshy: visor y prueba de locomoción

La nueva etapa adapta [defensa y los tres ataques del combo](RUEN_GAME_COMBAT.md);
su validación local aprobó con 173 unitarias y 40 casos únicos de navegador.
La fuente vigente `f828d841` está publicada, con confirmación de Actions.

La etapa anterior `50210a9c` incorporó **Idle, caminar y correr con equipo
optimizado** y redujo el escudo un 30%. Esas características se conservan en
la publicación vigente.
[Alcance de esta etapa](RUEN_GAME_EQUIPMENT.md).

El build anterior, `15a6a6c`, incluía el Idle neutro y la variante con
espada y escudo sólo en el visor. Esa revisión conserva como evidencia 142
pruebas unitarias y 10 casos de navegador locales. Los resultados históricos
de carga automática y reposo estático (`2045061`: 123 unitarias y 26 de
navegador) se conservan abajo; no validan la integración equipada actual.

## Archivo real y conservación del master

Origen: [release ruen-modelo-prueba](https://github.com/Dabot11/Veylun/releases/tag/ruen-modelo-prueba).
Se descargó directamente del release después de que el adjunto original
superara el límite de transferencia de 32 MiB. El archivo ya está en:

`public/assets/models/ruen/Meshy_AI_Crimson_Gemwarden_All_Animations.glb`

- Tamaño comprobado: **43,216,948 bytes**.
- SHA-256: `d662ef7c34a346379d15f6eb31069a60f35b2dd161911ed5d6df98232ad5db35`.
- El hash coincide con el publicado en GitHub. El master no se ha optimizado,
  reexportado ni reducido; se conserva su geometría, skin y animaciones.

## Abrir las dos pruebas

En GitHub Pages: [jugar con Ruen](https://dabot11.github.io/Veylun/)
y [visor](https://dabot11.github.io/Veylun/?inspect=ruen).
Los enlaces públicos muestran la última publicación registrada. La revisión
local carga el equipo optimizado por defecto; el visor mantiene los masters
completos y queda en pausa. Para probarla localmente:

```sh
cd /workspace/Veylun
npm run dev
```

Agrega uno de estos parámetros a la dirección que imprime Vite:

| Ruta | Comportamiento |
| --- | --- |
| `/` o `/?ruen=meshy` | Idle, caminar y correr con equipo optimizado; validado localmente. |
| `/?ruen=provisional` | Rig procedural anterior para todas las acciones. |
| `/?inspect=ruen` | Visor aislado; carga automática del master, pausado. |
| `/?inspect=ruen&motion=idle-v1` | Idle neutro propio de cuatro segundos, exclusivo del visor. |
| `/?inspect=ruen&motion=idle-v1&equipment=azure` | Idle con los masters de espada/escudo; escudo reducido un 30% en esta revisión. |

Las rutas locales también funcionan con `npm run preview`. El visor permite
**Recargar modelo original** o abrir un GLB local; el selector lee el archivo
en memoria y no lo sube a un servicio. El botón de prueba del visor abre el
modo jugable. El visor no accede a la simulación ni al guardado.

El visor carga pausado, selecciona Walking y reproduce un solo grupo a la vez.
Incluye selector con nombres reales, reproducir/pausar, reinicio, velocidad
0.1–2×, vistas frontal/lateral/trasera, órbita/zoom e inventario JSON exportable.
La pestaña oculta pausa la reproducción. El frente +Z se confirmó visualmente.

Las rutas de Idle seleccionan su clip propio en pausa. La variante con equipo
carga además los GLB de Azure Oathblade y Aegis of the Azure, conserva los
20 clips originales y añade dos clips propios al runtime. Su inventario de
equipo se exporta por separado del master. Ver [alcance y archivos](RUEN_EQUIPMENT_PREVIEW.md).

## Inventario comprobado

| Elemento | Resultado del archivo real |
| --- | --- |
| Malla | `output_unwrapped`; 70,995 vértices y 51,727 triángulos |
| Pose base | Altura 1.70 unidades; mínimo Y prácticamente cero |
| Material | `BakedMaterial`, PBR, doble cara |
| Skin | `SmartRigArmature`, 80 joints, máximo cuatro influencias |
| Texturas | Color 2048², normal 2048², metallic-roughness 4096² |
| Bytes de texturas | 23,906,395 |
| Extensiones | Sin `extensionsUsed` ni `extensionsRequired` declaradas |
| Clips | 20; 160 canales de traslación/rotación por clip |

Nombres reales: Running, Walking, Archery_Shot, Arise, Attack,
Axe_Breathe_and_Look_Around, Axe_Spin_Attack, Back_Jump, BeHit_FlyUp,
Climb_Attempt_and_Fall_1, Climb_Attempt_and_Fall_5, Climb_Left_with_Both_Limbs,
Collect_Object, Combat_Stance, RunFast, Sneaky_Walk, Weapon_Combo,
Weapon_Combo_1, Weapon_Combo_2, dying_backwards.

Walking dura **1.033333 s** y Running **0.633333 s**. La traslación neta de
pelvis de ambos es prácticamente cero (error inferior a 1.2e-7 unidades).
Se conservan el balanceo lateral y el movimiento vertical propios de los clips.
El inventario del visor refleja los nombres y recursos que cargó Babylon;
las extensiones se reportan como declaraciones del JSON, sin inferir plugins.

## Alcance del modo jugable

Esta revisión carga Meshy y dos copias ligeras del equipo automáticamente.
`Ruen_Idle_Equipped` incorpora respiración; `Ruen_Walk_Equipped` y
`Ruen_Run_Equipped` adaptan Walking/Running para mantener los agarres. La espada
sigue `mixamorig:RightHand`; el escudo sigue `mixamorig:LeftHand`. Su escala de
montaje pasa de 0.42 a 0.294, conservando el asa en la mano. Los tres grupos
propios se mezclan en 0.2 s y no modifican los 20 clips del master.

La fuente `f828d841` añade cinco grupos propios de guardia, bloqueo y ataques;
[detalles de combate](RUEN_GAME_COMBAT.md). `RuenLocomotionView` conserva el
rig provisional para salto, caída, aterrizaje, esquiva, daño, muerte, interacción
y victoria. También lo utiliza para desplazamientos laterales/hacia atrás
con objetivo fijado cuando no está defendiendo. El equipo real se oculta junto al modelo durante esos estados.
Si falla el master, se conserva el modelo provisional; si falla sólo una pieza
del equipo, se conserva el Ruen real sin equipo con Idle neutro y locomoción.
No se reinterpretan Combat_Stance ni Axe_Breathe_and_Look_Around como Idle o
bloqueo: el master no contiene esos clips neutros identificados.

El GLB tiene un contenedor exterior independiente del collider y del root
animado del rig provisional. Su posición/yaw vienen del controlador; la cámara
sigue `sim.player`, nunca la pelvis. La escala exterior uniforme es 1.45/1.70,
con corrección de yaw 0 y offset vertical 0. Se preserva toda la jerarquía glTF,
incluido el nodo de conversión de Babylon, y no se normalizan huesos.

La carga usa Babylon.js 9.31.0, `LoadAssetContainerAsync` y
`GLTFLoaderAnimationStartMode.NONE`. En gameplay se mezclan los tres grupos
propios con pesos complementarios; las transiciones entre caminar y correr
alinean la fase y detienen el grupo saliente. Los originales Walking/Running
son fuentes de las copias adaptadas, no clips alterados. Los otros 18 clips
permanecen fuera del gameplay.

La velocidad del ciclo se calcula con desplazamiento horizontal real dividido
por avance de `sim.age`, después de colisiones. No utiliza `vx/vz` deseados ni
multiplica `speedRatio` por delta time otra vez. Las referencias iniciales son
1.2 unidades/s para Walking y 4.0 para Running, estimadas desde la fase baja
de los dedos del pie a la escala del juego; no son metadatos del autor.
Un cociente entre tiempo admitido por el controlador y tiempo real del frame
compensa su límite de 100 ms en frames lentos, sin cambiar la simulación.
La muestra se reinicia al cambiar de simulación/jugador o detectar un teleport.
Un bloqueo por colisión congela el ciclo; los menús pausan la animación.

Las reglas de movimiento, salto, combate, daño, checkpoints y guardado siguen
perteneciendo al MVP. El GLB no genera daño ni añade arco, hacha, escalada,
parry o ataques cargados. Idle, locomoción, defensa y los tres ataques están
adaptados y comprobados en navegador. Salto y esquiva requieren su propia
adaptación y revisión posteriores.

## Revisión visual y límites

**Inspección histórica del master en el visor real:** carga PBR y tres texturas; reproducción de
Walking/Running; pausa y exclusividad; vistas frontal, lateral y trasera.
Manos, hombros, rodillas y capa se mantienen unidos y con poses coherentes
en las muestras revisadas. La consola de esta inspección no registró errores.
La pose base estática también se revisó de [frente](evidence/ruen-meshy/idle-front.png)
y de [espaldas](evidence/ruen-meshy/idle-back.png); no es un clip Idle animado.

El muestreo de piel detecta una separación de suela en Walking de
0.028–0.039 unidades originales: unos 2.4–3.3 cm a la escala del juego.
Running incluye fases aéreas. Contacto preciso, deslizamiento de pies y calidad
final de deformación requieren más ajuste visual; no se eliminaron movimientos
verticales de huesos para ocultar esas diferencias.

Attack dura 2.8 s; Weapon_Combo, Weapon_Combo_1 y Weapon_Combo_2 duran
3.667/3.5/4.5 s y son secuencias completas, no los tres golpes del combo del MVP.
Sus desplazamientos netos Z son 1.228539/2.075661/0.989594 unidades;
Back_Jump retrocede 1.992362 y Sneaky_Walk avanza 1.087022. Combat_Stance
tiene además un offset absoluto de pelvis X aproximado de 0.364 unidades.
Estos clips requieren revisar coreografía, ventanas de impacto y tratamiento
del root motion antes de probar combate. No están conectados a daño.

## Pruebas y evidencia

La revisión equipada aprobó typecheck, build, **152 pruebas unitarias en 16
archivos y 33 de navegador**, sin omisiones ni reintentos. La fuente publicada
es `50210a9c`; resultados, capturas y confirmación en
[la evidencia actual](evidence/ruen-game-equipment/README.md).

**Revisión histórica de reposo estático:** typecheck y build correctos; **123 pruebas unitarias en
12 archivos y 26 de navegador aprobadas**, estas últimas en una ejecución de
18.6 minutos sin reintentos. Son 17 casos del MVP, tres del visor con fixture
sintético y seis de integración: cuatro cargan el master (visor, reposo/locomoción,
colisión y build de producción), uno aborta su descarga y otro verifica el
opt-out sin descargarlo. Estas pruebas se ejecutaron contra servidores locales.
Ver [log histórico](evidence/ruen-meshy/default-idle-browser.log),
[reposo jugable](evidence/ruen-meshy/gameplay-idle.png) y
[reposo en el build de producción](evidence/ruen-meshy/production-default-idle.png).

Fuente publicada: `2045061ea5edffa5e93164ffe446b8034cf715dc` de `main`, con
el mismo árbol que la revisión probada `ad86656`. Publicación `gh-pages`:
`99da774c01f0c797c25eb7a9361b4a0ecad0318c`, confirmada con **Success** en
[Actions 39839671135](https://github.com/Dabot11/Veylun/actions/runs/39839671135).
La verificación pública se hizo mediante Actions; el sitio remoto no se
comprobó en navegador por la restricción de red del entorno.

Los siguientes resultados históricos corresponden a `6a80022`:

- La inspección de esa revisión confirmó 20 clips, 80 joints, las tres
  texturas y cambios de pose de Walking/Running, con consola sin errores.
  Los otros 18 clips sólo están inventariados.
- **Typecheck y build correctos; 119 pruebas unitarias en 12 archivos y
  24 pruebas de navegador aprobadas**. La suite de navegador pasó en una
  ejecución de 11.8 minutos sin reintentos.
- Cuatro casos de integración cubren carga/locomoción en el visor, mezcla y
  fallbacks jugables, bloqueo por colisión y recuperación ante error de carga.
  La misma suite cubre el MVP completo y tres casos del visor con fixture
  sintético; estos últimos no sustituyen la revisión del master real.
- El build emite un aviso de chunk del cargador glTF superior a 500 kB,
  sin fallo. La optimización del asset queda pendiente.
- Xbox físico y FPS/rendimiento en el Mac de David: no probados.
- Publicación `ab38a2c` del código `6a80022` confirmada mediante
  [Actions 39832580525](https://github.com/Dabot11/Veylun/actions/runs/39832580525),
  resultado **Success**, incluido el job **Deploy to GitHub Pages**.
  El sitio remoto no se comprobó en navegador por la restricción de red del
  entorno. Las pruebas de navegador anteriores usaron servidores locales.

La [galería de evidencia](evidence/ruen-meshy/README.md) incluye seis capturas
del master real en el visor y una del modo jugable corriendo. También se
conservan la [auditoría del archivo](evidence/ruen-meshy/master-audit.json), el
[inventario cargado](evidence/ruen-meshy/browser-inventory.json), la
[consola del visor](evidence/ruen-meshy/inspector-console.json), el
[muestreo de piel](evidence/ruen-meshy/locomotion-skin-samples.json) y el
[log de la suite completa](evidence/ruen-meshy/full-browser.log).
La captura jugable corresponde a Running en la revisión previa, que usaba el
rig provisional en reposo y otras acciones. El fixture sintético separado en
`tests/fixtures/inspection-glb.ts` no representa a Ruen.

## Optimización posterior y reversión

Hay 7,121 accessors sin referencia y 8,103,505 bytes BIN no referenciados.
En otra etapa, crear una copia de distribución con nombre propio, eliminar
sólo datos no referenciados, validar glTF y comparar clips/skin/apariencia.
Evaluar KTX2/Basis y resolución metallic-roughness midiendo carga y memoria
en el equipo objetivo. Conservar siempre el master y su hash; no reducir
geometría del master de Ruen en esta etapa. El equipo sí dispone de copias
independientes optimizadas, con su [inventario](evidence/ruen-game-equipment/runtime-inventory.json).

Para usar el rig anterior en esta revisión, abre `?ruen=provisional`; no hay
migraciones de guardado. La rama `work` conserva el MVP previo y `9d64cf5`
el visor antes de integrar el master. Los commits del experimento se pueden
revertir; cambiar el contenido publicado requiere desplegar de nuevo.
