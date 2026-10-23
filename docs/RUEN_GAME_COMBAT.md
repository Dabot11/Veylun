# Guardia, bloqueo y combo de Ruen

Estado: **validado y publicado desde `f828d841`, con 173 unitarias y 40 casos de navegador**.
Esta etapa adapta la defensa y los tres golpes del combo al Ruen real con
espada y escudo. Amplía Idle y locomoción equipados de la versión anterior
`50210a9c`, sustituyendo su rig provisional durante estas acciones.

## Alcance

Las animaciones se crean mediante keyframes sobre el esqueleto de 80 joints
del modelo existente. No se reconstruye a Ruen con primitivas. La factoría
`createRuenEquippedCombat` crea cinco grupos en memoria: `Ruen_Guard_Equipped`,
`Ruen_Block_Equipped` y `Ruen_Attack1_Equipped` a `Ruen_Attack3_Equipped`.
Los ataques son un corte diagonal, un revés y un golpe alto, con anticipación,
golpe y recuperación.

Los cinco grupos cubren los mismos 160 canales que el Idle equipado. Las
rotaciones nuevas afectan a Spine1/Spine2, brazos y manos; conservan el agarre
de los dedos y la base de las piernas. La guardia móvil combina después el
movimiento de la parte inferior del cuerpo con esta postura del torso.

La guardia tiene un ciclo de cuatro segundos. La reacción al bloqueo dura
0.22 s y alcanza su retroceso máximo a los 0.07 s. Los ataques siguen las
ventanas que ya utiliza `src/player/combat.ts`:

| Golpe | Preparación | Fin de ventana activa | Duración total | Daño existente |
| --- | ---: | ---: | ---: | ---: |
| Primero | 0.14 s | 0.29 s | 0.48 s | 1 |
| Segundo | 0.16 s | 0.32 s | 0.50 s | 1 |
| Tercero | 0.23 s | 0.39 s | 0.63 s | 2 |

Los grupos usan 60 fotogramas por segundo y la integración selecciona el
fotograma con `attackTime × 60`, sin un reloj visual independiente. La entrada
al ataque se mezcla durante 0.06 s, antes de la primera ventana de daño, y la
salida a locomoción durante 0.1 s. Guardia, reacción y pausa siguen el tiempo
de simulación. Los clips no añaden desplazamiento de raíz ni calculan daño;
el controlador y la simulación conservan esas responsabilidades.

## Modelos y agarres

Se conservan el master de Ruen, los dos originales del equipo y las dos copias
optimizadas del juego. Los cinco GLB coinciden por SHA-256 con los inventarios
de la versión publicada `50210a9c`; [verificación de hashes](evidence/ruen-game-combat/asset-hashes.json).
Los 20 clips del master permanecen separados de los nuevos grupos en memoria.

El escudo mantiene escala 0.294, equivalente al 70% del montaje inicial 0.42.
La espada mantiene 0.55. Los agarres siguen las manos reales y el juego mantiene
las copias optimizadas de 7,608,828 bytes y 122,930 triángulos en conjunto.
[Inventario de equipo publicado](evidence/ruen-game-equipment/runtime-inventory.json).

## Revisión visual e integración

Abre [el juego](https://dabot11.github.io/Veylun/?v=f828d841) o el
[visor de combate](https://dabot11.github.io/Veylun/?inspect=ruen&motion=combat-v1&v=f828d841).
Con `npm run dev`, la ruta local es `?inspect=ruen&motion=combat-v1&equipment=azure`.
Carga el master de Ruen y las copias optimizadas del equipo utilizadas por el
juego; el visor anterior `motion=idle-v1` conserva los originales completos.
La nueva ruta comienza en Guardia, pausada. El selector permite elegir
**Bloqueo recibido**, **Ataque 1 · corte diagonal**, **Ataque 2 · revés** o
**Ataque 3 · golpe alto**, además de Idle y locomoción. Usa las vistas frontal,
lateral y trasera, y reduce la velocidad para revisar cada pose. Los clips se
repiten en el visor para facilitar la revisión.

Desmarcar **Espada y escudo** vuelve al Idle neutro; elegir un clip original
oculta el equipo. Un fallo de carga conserva el Idle neutro y permite
reintentar. La vista previa no aplica daño ni sustituye una prueba del combate
desde los controles.

La integración cubre guardia y ataques con los pies en el suelo y el equipo
cargado. En guardia, Ruen puede caminar en la dirección del desplazamiento
real: caderas y piernas siguen los pasos y el torso mantiene la orientación
del controlador. La fase de los pies depende de la distancia recorrida y se
detiene al bloquearse contra una pared. La calibración manual revisó adelante,
atrás, izquierda y derecha. La prueba desde controles comprobó bloqueo y
desplazamiento lateral en guardia con objetivo fijado.

Salto, caída, aterrizaje, esquiva, daño, muerte, interacción, victoria y
desplazamiento lateral/hacia atrás sin defender mantienen el rig provisional.
Si falla una pieza del equipo, Idle/caminar/correr conservan las variantes
reales sin armas y el combate usa el rig provisional, sin equipo parcial.
Las pruebas de navegador comprobaron las transiciones, la pausa, las
interrupciones por esquiva/daño y los fallos de carga.

## Validación y siguiente paso

La fuente final aprobó typecheck, build y **173 pruebas unitarias en 17 archivos**,
estas últimas en 3.24 s. El build conserva el aviso conocido de chunks grandes de
Babylon. La calibración manual de poses sobre la malla real revisó los tres
ataques y comprobó la espada sobre el suelo, sin errores de página; todavía
no sustituye las pruebas del combate desde controles, registradas por separado.

La guardia móvil se revisó manualmente en cuatro direcciones. La primera
tanda nueva de navegador terminó con 3 aprobados y 4 fallidos. Se corrigieron
la repetición del visor a `CYCLE`, con una regresión que falló antes y pasa
después, y la tolerancia numérica de agarres.
Tras corregirlo aprobaron los **siete casos nuevos de navegador**, sin
omisiones ni reintentos, en 6 min 48.809 s. La regresión terminó con 32 de 33
aprobados en 29 min 40.410 s; el caso restante esperaba un texto antiguo. Tras
corregir sólo esa expectativa aprobó en 2.720 s, con la aplicación y el build
intactos. El cierre suma **40 casos únicos aprobados en tres tandas**, con esa
repetición documentada. [Actions 39905860479](https://github.com/Dabot11/Veylun/actions/runs/39905860479)
confirmó la publicación de `f828d841`; [registro de despliegue](DEPLOYMENT.md).
Las 152 unitarias y 33 de navegador de `50210a9c` pertenecen
a la versión anterior. [Evidencia actual](evidence/ruen-game-combat/README.md).

La etapa posterior, [salto y voltereta](RUEN_GAME_TRAVERSAL.md), está validada
y publicada desde `b83b0f36`. Después siguen daño y las
demás acciones, manteniendo sus tiempos y reglas actuales.
