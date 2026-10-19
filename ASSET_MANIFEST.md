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
| ruen | `createRuen` en `src/assets/characters.ts` | ~1.45 m | Cobre, marfil, verde petróleo, cuero, metal cálido y gemas. Cadera, cabeza, brazos, piernas, capa, espada y escudo | 3D procedural provisional |
| corrupt-sprout | `createEnemyRig(..., 'sprout')` | ~1.1 m | Corteza, raíces, musgo, hojas y ojos ámbar. Cuerpo encorvado, cabeza baja y grandes brazos delanteros | 3D procedural provisional |
| wandering-spirit | `createEnemyRig(..., 'spirit')` | ~1.25 m incluyendo aletas y cola | Núcleo emisivo, máscara de madera, ojos grandes, hojas y aletas de energía | 3D procedural provisional |
| ancestral-guardian | `createEnemyRig(..., 'guardian')` | ~4.2 m | Raíces, placas de piedra, vegetación y runas turquesa. Cuerpo, cabeza, brazos y piernas | 3D procedural provisional |
| forest-world | `src/world/WorldView.ts` | 1 unidad = 1 m | Suelo, árboles, raíces, flores, ruinas, acantilados, cascadas, reja, cofre, puerta y altar | Entorno procedural provisional |
| surfaces | `src/assets/surfaceTexture.ts` | 128 × 128 por textura | Pigmento de piedra, corteza, tela y suelo; generación canvas original | Texturas de runtime |
| sound-fx | `src/audio/AudioManager.ts` | Síntesis Web Audio | Pasos, espada, impacto, escudo, rodada, proyectil, cofre, interruptor, checkpoint, derrota y victoria | Efectos originales funcionales |

No hay modelos de personajes definitivos, GLB exportados ni clips externos.
No se recibió un modelo listo para ejecutar: todos los PNG son referencias 2D.
Las mallas provisionales simplifican mucho las ilustraciones y no equivalen a
una conversión automática de alta calidad.

## Animación

Ruen implementa idle, caminar, correr, salto, caída, aterrizaje, rodada, tres
ataques, escudo, daño, muerte, interacción y victoria mediante transformaciones
de partes articuladas. Enemigos tienen patrulla/flotación, anticipación, ataque,
recuperación, reacción y colapso. Son animaciones procedurales; no hay rig
esquelético exportado ni cloth simulation.

## Sustitución por GLB

Ubicar modelos optimizados en `public/assets/models/`, con origen en el suelo,
eje vertical Y, orientación +Z y escala métrica aplicada. Registrar ruta real
relativa a `public/` y nombres de clips en `assetCatalog.ts`. `VisualOverrides`
carga el contenedor, lo vincula a la raíz visual y oculta el provisional;
conserva el provisional si falla la carga. Mismos controladores y reglas jugables.

Los originales de alta resolución permanecen fuera de `public/` y `dist/`.
No se usan assets ni audio de otros videojuegos. El render usa WebGL y no
requiere WebGPU ni servicios externos.
