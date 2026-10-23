# Manifest de recursos

## Referencias entregadas y revisadas

| ID | Fuente y ruta local | Vistas y poses | Estado |
|---|---|---|---|
| ruen | `1. Ruen.zip` → `design/references/ruen/` | Frontal/tres cuartos, carrera lateral, espalda en tres cuartos, ataque y defensa | 6 PNG revisados |
| corrupt-sprout | `1. Brote corrupto.zip` → `design/references/corrupt-sprout/` | Frontal, laterales/tres cuartos, embestida y guardia | 6 PNG revisados |
| wandering-spirit | `2. Espíritu errante.zip` → `design/references/wandering-spirit/` | Frontal, lateral, posterior, preparación de proyectil y flotación | 6 PNG revisados |
| ancestral-guardian | `3. Guardián ancestral.zip` → `design/references/ancestral-guardian/` | Frontal, lateral, posterior, golpe al suelo, raíces y reposo | 6 PNG revisados |
| awakening-reference | Imagen del santuario visible en el chat | Claro circular, ruinas, bosque y cascadas | Referencia 2D revisada; binario no disponible localmente |

Cada carpeta de personaje incluye los originales, `inventory.json` con nombres,
dimensiones y SHA-256 y una ficha `README.md`. Los archivos se conservaron sin
editar; se omitieron los metadatos `__MACOSX`. El ZIP conjunto inicial no pudo
transferirse por superar 32 MiB; las cuatro entregas individuales lo sustituyen.

## Assets ejecutables

| ID | Implementación | Escala inicial | Materiales y articulación | Estado |
|---|---|---|---|---|
| ruen | `createRuen` en `src/assets/ruen.ts` | ~1.45 m | Cobre, marfil, verde petróleo, cuero, metal cálido y gemas facetadas. Cadera, cabeza, hombros, codos, piernas, rodillas, capa, espada y escudo | 3D procedural provisional, primera revisión artística |
| ruen-meshy | `public/assets/models/ruen/Meshy_AI_Crimson_Gemwarden_All_Animations.glb` mediante `RuenLocomotionView` | 1.45/1.70 sobre el master | PBR con tres texturas, skin de 80 joints y 20 clips originales | Idle y locomoción equipados validados localmente; master intacto |
| ruen-azure-sword | GLB Azure Oathblade en `public/assets/models/ruen/equipment/` | Ajuste exterior del visor | Malla rígida, material PBR y tres texturas; vinculada a `mixamorig:RightHand` | Master del visor intacto; montaje validado localmente |
| ruen-azure-shield | GLB Aegis of the Azure en `public/assets/models/ruen/equipment/` | Escala exterior 0.294; 30% menor que 0.42 | Malla rígida, material PBR y tres texturas; vinculada a `mixamorig:LeftHand` | Master del visor intacto; montaje validado localmente |
| ruen-azure-sword-runtime | `public/assets/models/ruen/equipment/runtime/azure-oathblade.glb` | Escala exterior 0.55, dentro del root de Ruen | Copia de 19,640 triángulos; PBR y tres texturas 1024² | Integrada en gameplay; validación local aprobada |
| ruen-azure-shield-runtime | `public/assets/models/ruen/equipment/runtime/aegis-of-the-azure.glb` | Escala exterior 0.294, dentro del root de Ruen | Copia de 103,290 triángulos; PBR y tres texturas 1024² | Integrada en gameplay; validación local aprobada |
| corrupt-sprout | `createEnemyRig(..., 'sprout')` | ~1.1 m | Corteza, raíces, musgo, hojas y ojos ámbar. Cuerpo encorvado, cabeza baja y grandes brazos delanteros | 3D procedural provisional |
| wandering-spirit | `createEnemyRig(..., 'spirit')` | ~1.25 m incluyendo aletas y cola | Núcleo emisivo, máscara de madera, ojos grandes, hojas y aletas de energía | 3D procedural provisional |
| ancestral-guardian | `createEnemyRig(..., 'guardian')` | ~4.2 m | Raíces, placas de piedra, vegetación y runas turquesa. Cuerpo, cabeza, brazos y piernas | 3D procedural provisional |
| forest-world | `src/world/WorldView.ts` | 1 unidad = 1 m | Suelo, árboles, raíces, flores, ruinas, acantilados, cascadas, reja, cofre, puerta y altar | Entorno procedural provisional |
| awakening-dressing | `src/world/awakeningArt.ts` | 1 unidad = 1 m | Anillos de piedra, grabados, frondas, flores, hiedra y musgo; sombras locales del dosel | Primera revisión del claro |
| surfaces | `src/assets/surfaceTexture.ts` | 128 × 128 por textura | Pigmento de piedra, corteza, tela y suelo; generación canvas original | Texturas de runtime |
| sound-fx | `src/audio/AudioManager.ts` | Síntesis Web Audio | Pasos, espada, impacto, escudo, rodada, proyectil, cofre, interruptor, checkpoint, derrota y victoria | Efectos originales funcionales |

El master de Meshy se recibió mediante el release `ruen-modelo-prueba` y se
verificó por SHA-256. Sus 20 clips se conservan sin editar. Esta revisión
adapta Walking/Running y el Idle propio para portar equipo; los otros 18 clips
siguen inventariados, sin asignación automática al gameplay. El arte final
continúa pendiente. Los PNG son referencias 2D, no una conversión automática
de alta calidad. Ver el [informe del master](docs/RUEN_MESHY_INSPECTION.md).

Los dos GLB de equipo se recibieron como adjuntos. Cada original tiene una malla,
un material PBR y tres texturas JPEG 2048², sin skin ni clips. Suman 44,478,640
bytes y 906,832 triángulos, y se conservan sin reexportar. El visor los carga
completos. Los nombres y hashes están en la [ficha del equipo](docs/RUEN_EQUIPMENT_PREVIEW.md).

El juego usa copias independientes con los mismos ejes, origen y puntos de
agarre: 7,608,828 bytes y 122,930 triángulos entre ambas, con texturas 1024².
El mapa de normales se adapta a la malla reducida y se guarda como PNG sin
pérdida; color y metal/rugosidad usan JPEG de calidad 90. El equipo requiere
82.9% menos bytes y 86.4% menos triángulos que los originales.
`scripts/optimize-ruen-equipment.py` reproduce la reducción con Blender 4.3.2
y comprueba los hashes de los originales. La reducción de tamaño del escudo
es un ajuste exterior de 0.42 a 0.294; no está horneada en ninguna malla.
[Inventario comparativo](docs/evidence/ruen-game-equipment/runtime-inventory.json).

La integración está publicada desde `50210a9c`; ver el
[registro de despliegue](docs/DEPLOYMENT.md).

## Animación

La nueva etapa crea `Ruen_Guard_Equipped`, `Ruen_Block_Equipped` y
`Ruen_Attack1_Equipped` a `Ruen_Attack3_Equipped` sobre el rig real. Sus 160
canales parten del Idle equipado, con rotaciones propias de torso, brazos y
manos. El montaje del escudo sigue en 0.294 y el de la espada en 0.55.
La fuente final aprobó typecheck, build y 173 pruebas unitarias tras corregir
los hallazgos iniciales del navegador. Los cinco GLB conservan
sus hashes publicados; [verificación](docs/evidence/ruen-game-combat/asset-hashes.json).
Los 40 casos únicos de navegador aprobaron, con una repetición aislada
tras corregir el texto esperado de un test. Publicación pendiente: [alcance del combate](docs/RUEN_GAME_COMBAT.md).

El rig provisional conserva idle, caminar, correr, salto, caída, aterrizaje,
rodada, ataques, escudo, daño, muerte, interacción y victoria. Enemigos tienen
patrulla/flotación, anticipación, ataque, recuperación, reacción y colapso.

La versión publicada crea `Ruen_Idle_Equipped`, `Ruen_Walk_Equipped` y
`Ruen_Run_Equipped` sobre el rig original. Idle usa la respiración de cuatro
segundos; caminar/correr conservan cuerpo y piernas de Walking/Running y
adaptan brazos, manos y dedos para el agarre. Los tres grupos cubren los mismos
canales y se mezclan durante 0.2 s. Los archivos y clips originales no cambian.
No se añadió simulación de tela: la capa sigue su skin.

Si falla una pieza, se usan las variantes sin equipo `Ruen_Idle_Unarmed`,
`Ruen_Walk_Unarmed` y `Ruen_Run_Unarmed`, y se oculta cualquier carga parcial.
Las acciones todavía no adaptadas conservan el rig provisional y sus reglas.
El visor mantiene `Ruen_Idle_v1` y `Ruen_Idle_Armed_v1` para comparar los masters;
sus inventarios siguen separados de los grupos creados en memoria.

## Sustitución por GLB

Ubicar modelos optimizados en `public/assets/models/`, con origen en el suelo,
eje vertical Y, orientación +Z y escala métrica aplicada. Registrar ruta real
relativa a `public/` y nombres de clips en `assetCatalog.ts`. `VisualOverrides`
carga el contenedor, lo vincula a la raíz visual y oculta el provisional;
conserva el provisional si falla la carga. Mismos controladores y reglas jugables.

La prueba Meshy usa un contenedor independiente del root procedural, conserva
toda la jerarquía importada y no pasa por `VisualOverrides`. Su master intacto
se incluye en `public/` y `dist/`; optimizarlo exige una copia con nombre distinto.
Las referencias PNG originales permanecen fuera de `public/` y `dist/`.
No se usan assets ni audio de otros videojuegos. El render usa WebGL y no
requiere WebGPU ni servicios externos.
