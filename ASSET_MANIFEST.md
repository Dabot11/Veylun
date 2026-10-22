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
| ruen-meshy | `public/assets/models/ruen/Meshy_AI_Crimson_Gemwarden_All_Animations.glb` mediante `RuenLocomotionView` | 1.45/1.70 sobre el master | PBR con tres texturas, skin de 80 joints y 20 clips inventariados | Carga por defecto, reposo estático y Walking/Running; pruebas locales aprobadas y versión `2045061` publicada |
| corrupt-sprout | `createEnemyRig(..., 'sprout')` | ~1.1 m | Corteza, raíces, musgo, hojas y ojos ámbar. Cuerpo encorvado, cabeza baja y grandes brazos delanteros | 3D procedural provisional |
| wandering-spirit | `createEnemyRig(..., 'spirit')` | ~1.25 m incluyendo aletas y cola | Núcleo emisivo, máscara de madera, ojos grandes, hojas y aletas de energía | 3D procedural provisional |
| ancestral-guardian | `createEnemyRig(..., 'guardian')` | ~4.2 m | Raíces, placas de piedra, vegetación y runas turquesa. Cuerpo, cabeza, brazos y piernas | 3D procedural provisional |
| forest-world | `src/world/WorldView.ts` | 1 unidad = 1 m | Suelo, árboles, raíces, flores, ruinas, acantilados, cascadas, reja, cofre, puerta y altar | Entorno procedural provisional |
| awakening-dressing | `src/world/awakeningArt.ts` | 1 unidad = 1 m | Anillos de piedra, grabados, frondas, flores, hiedra y musgo; sombras locales del dosel | Primera revisión del claro |
| surfaces | `src/assets/surfaceTexture.ts` | 128 × 128 por textura | Pigmento de piedra, corteza, tela y suelo; generación canvas original | Texturas de runtime |
| sound-fx | `src/audio/AudioManager.ts` | Síntesis Web Audio | Pasos, espada, impacto, escudo, rodada, proyectil, cofre, interruptor, checkpoint, derrota y victoria | Efectos originales funcionales |

El master de Meshy se recibió mediante el release `ruen-modelo-prueba` y se
verificó por SHA-256. Walking y Running se revisaron visualmente; los otros
18 clips están inventariados, sin aprobación para gameplay. La revisión actual
carga Meshy en `/` y conserva `?ruen=provisional` como alternativa. Su pose base
exacta se revisó frontalmente y de espaldas para el reposo estático, sin crear
un clip Idle. Esta revisión está publicada en GitHub Pages; el arte final sigue pendiente.
Los PNG son referencias 2D, no una conversión automática de alta calidad. Ver el
[informe y evidencia](docs/RUEN_MESHY_INSPECTION.md).

## Animación

Ruen implementa idle, caminar, correr, salto, caída, aterrizaje, rodada, tres
ataques, escudo, daño, muerte, interacción y victoria mediante transformaciones
de partes articuladas. Enemigos tienen patrulla/flotación, anticipación, ataque,
recuperación, reacción y colapso. El rig provisional conserva esas animaciones.
Meshy usa la pose base estática en reposo y mezcla sólo Walking/Running, con
fallback para acciones sin clip validado. La transición reposo↔locomoción dura
0.2 s; no se añade respiración ni offsets a la pose base. La capa del
GLB sigue su skin; no se añadió simulación de tela.

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
