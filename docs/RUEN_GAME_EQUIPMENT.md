# Ruen equipado dentro del juego

Estado histórico: **Idle y locomoción publicados desde `50210a9c`**.
La versión vigente `f828d841` añade [guardia, bloqueo y combo](RUEN_GAME_COMBAT.md).
Esta etapa lleva Idle, caminar y correr con espada y escudo a la ruta normal
del juego. El usuario pidió reducir el escudo un 30% respecto al prototipo.
La versión anterior `15a6a6c` sólo mostraba el equipo en el visor.

## Probar esta revisión

Abre [el juego publicado](https://dabot11.github.io/Veylun/) y comienza o continúa
una partida. También puedes abrir `/` con `npm run dev`. Ruen y las
copias ligeras del equipo se cargan automáticamente. El personaje mantiene
espada y escudo al estar quieto, caminar y correr; al detenerse reproduce
un ciclo de respiración de cuatro segundos. No hay que cargar los GLB a mano.

`?ruen=meshy` conserva el mismo comportamiento. `?ruen=provisional` utiliza el
modelo anterior y evita la descarga del master y sus armas.
El [visor de equipo](RUEN_EQUIPMENT_PREVIEW.md) sigue disponible en
`?inspect=ruen&motion=idle-v1&equipment=azure`, con los originales completos.

## Tamaño y archivos

El escudo usa escala exterior **0.42 × 0.7 = 0.294** tanto en el visor como en
el juego. Es una reducción lineal uniforme del 30%, no un cambio de volumen ni
un desplazamiento del asa. El pivote sigue siendo el punto de agarre medido.
La espada conserva la escala exterior 0.55. Ambos heredan la escala del root
de Ruen en gameplay, 1.45/1.70.

Las copias del juego se guardan en `public/assets/models/ruen/equipment/runtime/`:

| Pieza | Copia jugable | Bytes | Triángulos |
| --- | --- | ---: | ---: |
| Espada | `azure-oathblade.glb` | 2,622,456 | 19,640 |
| Escudo | `aegis-of-the-azure.glb` | 4,986,372 | 103,290 |
| Total | | 7,608,828 | 122,930 |

La optimización final conserva el acabado de las superficies doradas y reduce
el equipo un **82.9% en bytes y 86.4% en triángulos**. Los hashes y mediciones
están en el [inventario comparativo](evidence/ruen-game-equipment/runtime-inventory.json).
Cada copia mantiene una malla rígida, un material PBR y tres texturas 1024².
El mapa de normales se hornea desde la superficie original hacia la malla
reducida y se guarda como PNG sin pérdida. Color y metal/rugosidad permanecen
en JPEG de calidad 90.
Los originales suman 44,478,640 bytes y 906,832 triángulos, con texturas 2048².
Esta comparación corresponde sólo al equipo: el master de Ruen, de 43.22 MB,
no se ha reducido.

`scripts/optimize-ruen-equipment.py` reproduce la exportación con Blender 4.3.2.
Comprueba hashes de origen, transfiere las normales de la superficie original
y adapta su mapa a la base tangente de la copia. Conserva ejes, origen y puntos
de agarre, y exporta copias con nombres diferentes. La reducción de tamaño del
escudo se aplica en el montaje, nunca se hornea en las mallas. Los tres masters
permanecen intactos.

## Animación y estados

La espada se vincula a `mixamorig:RightHand` y el escudo a `mixamorig:LeftHand`.
Las piezas siguen los joints reales, conservando la conversión glTF. No se
reconstruye ninguna pieza con primitivas.

`Ruen_Idle_Equipped`, `Ruen_Walk_Equipped` y `Ruen_Run_Equipped` son grupos
creados en memoria. El Idle reutiliza la respiración y la postura del visor;
caminar/correr conservan cuerpo, pelvis, piernas y hombros de los clips
originales y reemplazan las rotaciones de brazos, manos y dedos por el agarre.
Los tres grupos cubren los mismos canales para evitar residuos de una pose
anterior y se mezclan durante 0.2 s.

El desplazamiento real del controlador, después de colisiones, determina la
velocidad de locomoción. El Idle sigue el tiempo admitido por la simulación;
los menús pausan la animación. La raíz sigue al controlador y la cámara sigue
al jugador. Ninguna animación genera un segundo desplazamiento ni daño.

Si falla una pieza del equipo, se oculta la carga parcial y se conservan
`Ruen_Idle_Unarmed`, `Ruen_Walk_Unarmed` y `Ruen_Run_Unarmed`. Si falla el master,
sigue disponible el rig provisional. El visor mantiene su propio botón de
reintento del equipo; no se añade un nuevo flujo de carga al juego.

En la revisión `50210a9c`, salto, caída, aterrizaje, esquiva, ataques, defensa,
daño, muerte, interacción,
victoria y desplazamiento lateral/hacia atrás con objetivo fijado conservan
el rig provisional. El equipo real se oculta durante esos estados. Sus reglas
de combate, colisiones, invulnerabilidad, checkpoints y guardado no cambian.

## Validación y siguiente etapa

Typecheck, build, **152 pruebas unitarias en 16 archivos y 33 de navegador**
aprobaron. La suite de navegador terminó en 28.7 minutos, en una ejecución
sin omisiones ni reintentos. El build conserva el aviso conocido de Vite sobre
chunks grandes. La [evidencia actual](evidence/ruen-game-equipment/README.md)
incluye capturas desde los controles, los agarres y transiciones, pausa,
colisión, fallos de carga y producción sin hooks.
[Actions 39889821939](https://github.com/Dabot11/Veylun/actions/runs/39889821939)
confirmó el despliegue; [registro de publicación](DEPLOYMENT.md).

La etapa posterior, publicada desde `f828d841`, adapta guardia/bloqueo y **los
tres golpes del combo**, con las ventanas de combate existentes: [combate equipado](RUEN_GAME_COMBAT.md).
Los resultados de esta ficha corresponden a Idle y locomoción.
