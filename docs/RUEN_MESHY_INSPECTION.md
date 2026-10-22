# Ruen / Meshy: visor y prueba de locomoción

Estado al 22 de octubre de 2026: **master real cargado; Walking/Running
revisados en el visor y prueba jugable validada con 24 tests de navegador**.
Rama: `feat/ruen-meshy-inspector`. Visor previo: `9d64cf5`; base del MVP:
`1928f65` en `work`. Esto no aprueba el arte final ni completa las animaciones.

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

```sh
cd /workspace/Veylun
npm run dev
```

Agrega uno de estos parámetros a la dirección que imprime Vite:

| Ruta | Comportamiento |
| --- | --- |
| `/?inspect=ruen` | Visor aislado, sin simulación ni acceso al guardado. |
| `/?ruen=meshy` | Prueba jugable de Walking/Running con fallback explícito. |
| `/` | MVP normal con su representación provisional existente. |

Estas rutas son de esta rama y también funcionan con `npm run preview`;
la prueba todavía no está desplegada en GitHub Pages. El visor permite
**Cargar desde el repositorio** o **Abrir GLB desde tu equipo**; el selector
local lee el archivo en memoria y no lo sube a un servicio. El botón de prueba
del visor abre el modo jugable; **Salir de la prueba** vuelve al MVP normal.

El visor carga pausado, selecciona Walking y reproduce un solo grupo a la vez.
Incluye selector con nombres reales, reproducir/pausar, reinicio, velocidad
0.1–2×, vistas frontal/lateral/trasera, órbita/zoom e inventario JSON exportable.
La pestaña oculta pausa la reproducción. El frente +Z se confirmó visualmente.

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

Sólo **Walking y Running** se conectan a los estados `walk` y `run` en
`?ruen=meshy`. El modo normal no activa el GLB. La UI identifica la prueba
y muestra cuándo se utiliza Meshy o el Ruen provisional.

`RuenLocomotionView` conserva el rig existente para reposo, salto, caída,
aterrizaje, esquiva, ataques, defensa, daño, muerte, interacción y victoria.
También conserva ese fallback para desplazamientos laterales/hacia atrás
con objetivo fijado. Un error de carga conserva el modelo provisional.
No se reinterpretan Combat_Stance ni Axe_Breathe_and_Look_Around como idle
neutro o bloqueo: no hay Idle, Block, Roll/Dodge ni salto normal identificados.

El GLB tiene un contenedor exterior independiente del collider y del root
animado del rig provisional. Su posición/yaw vienen del controlador; la cámara
sigue `sim.player`, nunca la pelvis. La escala exterior uniforme es 1.45/1.70,
con corrección de yaw 0 y offset vertical 0. Se preserva toda la jerarquía glTF,
incluido el nodo de conversión de Babylon, y no se normalizan huesos.

La carga usa Babylon.js 9.31.0, `LoadAssetContainerAsync` y
`GLTFLoaderAnimationStartMode.NONE`. En gameplay sólo se mezclan Walking y
Running durante 0.2 s, con fase alineada y pesos complementarios; después se
detiene el clip saliente. Los otros 18 clips permanecen fuera del gameplay.

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
parry o ataques cargados. Espada y escudo separados quedan para otra etapa,
vinculados a `mixamorig:RightHand` y `mixamorig:LeftHand` tras revisar offsets.

## Revisión visual y límites

**Verificado en el visor real:** carga PBR y tres texturas; reproducción de
Walking/Running; pausa y exclusividad; vistas frontal, lateral y trasera.
Manos, hombros, rodillas y capa se mantienen unidos y con poses coherentes
en las muestras revisadas. La consola de esta inspección no registró errores.

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

- La inspección actual del master real confirmó 20 clips, 80 joints, las tres
  texturas y cambios de pose de Walking/Running, con consola sin errores.
  Los otros 18 clips sólo están inventariados.
- **Typecheck y build correctos; 119 pruebas unitarias en 12 archivos y
  24 pruebas de navegador aprobadas**. La suite de navegador pasó en una
  ejecución de 11.8 minutos sin reintentos.
- Cuatro casos usan el master real: carga/locomoción en el visor, mezcla y
  fallbacks jugables, bloqueo por colisión y recuperación ante error de carga.
  La misma suite cubre el MVP completo y tres casos del visor con fixture
  sintético; estos últimos no sustituyen la revisión del master real.
- El build emite un aviso de chunk del cargador glTF superior a 500 kB,
  sin fallo. La optimización del asset queda pendiente.
- Xbox físico y FPS/rendimiento en el Mac de David: no probados.

La [galería de evidencia](evidence/ruen-meshy/README.md) incluye seis capturas
del master real en el visor y una del modo jugable corriendo. También se
conservan la [auditoría del archivo](evidence/ruen-meshy/master-audit.json), el
[inventario cargado](evidence/ruen-meshy/browser-inventory.json), la
[consola del visor](evidence/ruen-meshy/inspector-console.json), el
[muestreo de piel](evidence/ruen-meshy/locomotion-skin-samples.json) y el
[log de la suite completa](evidence/ruen-meshy/full-browser.log).
La captura jugable muestra Running; reposo y otras acciones usan el rig
provisional. El fixture sintético separado en `tests/fixtures/inspection-glb.ts`
no representa a Ruen.

## Optimización posterior y reversión

Hay 7,121 accessors sin referencia y 8,103,505 bytes BIN no referenciados.
En otra etapa, crear una copia de distribución con nombre propio, eliminar
sólo datos no referenciados, validar glTF y comparar clips/skin/apariencia.
Evaluar KTX2/Basis y resolución metallic-roughness midiendo carga y memoria
en el equipo objetivo. Conservar siempre el master y su hash; no reducir
geometría en esta tarea.

Para salir del experimento, elimina `?ruen=meshy` o `?inspect=ruen`; no hay
migraciones de guardado. La rama `work` conserva el MVP previo y `9d64cf5`
el visor antes de integrar el master. Los commits del experimento se pueden
revertir. Este cambio no publica ni modifica el sitio de GitHub Pages.
