# Arquitectura del MVP

## Flujo

`main.ts` crea `Application`: motor Babylon/WebGL, simulación, mundo visual,
cámara, entrada, HUD y audio. Los imports del motor utilizan submódulos.
`FixedStepLoop` actualiza lógica a 60 Hz y limita el tiempo acumulado tras
suspensión. El render se ejecuta independientemente; los menús conservan el
último frame salvo resize, carga o cambios de ajustes.

`InputManager.poll` lee Gamepad API en cada frame. Teclado y botones de mando
registran flancos en un conjunto; `take` consume cada acción solo en un tick.
Los flancos sobreviven a frames sin tick y no se duplican entre varios ticks.
La admisión de teclas consulta el menú actual en el propio evento, para no
perder entradas recibidas entre «Nueva partida»/«Continuar» y el siguiente frame.
Los sticks usan deadzone radial, los gatillos umbral configurable. El mouse
admite pointer lock y arrastre. Las entradas de teclado de menú se dejan al DOM.

## Módulos

| Módulo | Responsabilidad |
|---|---|
| `core/Simulation.ts` | Estado autoritativo, movimiento, FSM, combate y coordinación |
| `core/math.ts`, `FixedStepLoop.ts` | Matemática pura y tiempo de simulación |
| `player/combat.ts` | Ventanas del combo, volumen/orientación de espada y escudo |
| `player/attackAnimation.ts` | Preparación, barrido frontal y recuperación sincronizados con esas ventanas |
| `world/level.ts` | Zonas, altura de suelo y colliders compartidos |
| `world/WorldView.ts` | Bosque, arquitectura, interacciones y feedback visual |
| `world/CombatEffects.ts` | Cuatro ráfagas reutilizables de impacto, con 24 partículas como máximo |
| `enemies/types.ts` | Tipos de enemigo y estados |
| `input` | Acciones abstractas y adaptadores de dispositivo |
| `camera/FollowCamera.ts` | Seguimiento, órbita, colisión y encuadre del objetivo |
| `progression` | Datos versionados, validación y almacenamiento local |
| `assets/characters.ts` | Modelos originales y animaciones procedurales |
| `assets/VisualOverrides.ts`, `ModelLoader.ts` | Sustitución opcional por GLB y clips |
| `assets/geometry.ts`, `surfaceTexture.ts` | Mallas, materiales y texturas originales |
| `ui/UI.ts` | HUD, menús, ajustes y navegación de mando |
| `ui/CombatHUD.ts` | Vida del enemigo, estado de ataque y confirmación de daño/bloqueo |
| `audio/AudioManager.ts` | Efectos Web Audio activados tras gesto |
| `config/gameConfig.ts` | Parámetros de diseño y balance inicial |

## Colisión y combate

Controlador cinemático propio: movimiento X/Z con subpasos de hasta 0.18 m,
resolución por ejes, radio de jugador y altura del obstáculo. Gravedad/salto
vertical con suelo analítico. Mismos obstáculos para cámara y proyectiles.
La cámara barre un volumen con margen y recupera distancia gradualmente.
Paredes, árboles, rocas, pilares, reja y puerta cerrada impiden atravesarlos.
Los bordes son sólidos; una posición inválida o caída fuera del mundo restaura
el último checkpoint.

FSM de Ruen: quince estados de animación, con tiempos acotados. Ataques
mantienen un conjunto de enemigos ya golpeados por ventana. El alcance incluye
radio enemigo, diferencia vertical, cono frontal y obstrucciones sólidas entre
Ruen y el enemigo. La dirección se resuelve al iniciar cada golpe, priorizando
el objetivo fijado y después el movimiento. Un buffer de 150 ms conserva
pulsaciones recientes durante la recuperación; solo se encola el siguiente
golpe y recibir daño cancela el combo. La animación usa los mismos tiempos que
la detección de daño, con la espada delante durante la ventana activa.
Escudo 110°; rodada breve
con invulnerabilidad parcial y recuperación. Enemigos separados en FSM de
patrulla/persecución, preparación, ataque, recuperación y muerte. La muerte
elimina ataques; proyectiles ya emitidos tienen vida independiente y acotada.

Los Brotes comparten un turno de preparación/embestida y una separación de
350 ms entre ataques. Un bloqueo frontal pasa directamente a recuperación.
Los enemigos ordinarios pausan su estado 120 ms al recibir un golpe, o 240 ms
con el tercero del combo; el Guardián conserva su ritmo. El evento de impacto
incluye enemigo, daño efectivo y posición para sincronizar HUD, sonido y
partículas. El destello usa overlays por malla, sin alterar materiales compartidos.

La fijación prioriza la dirección de cámara y excluye líneas de visión
obstruidas. LB/RB recorren los objetivos de izquierda a derecha; una obstrucción
de más de 600 ms libera el objetivo. La órbita manual suspende el recentrado
650 ms. El encuadre eleva y desplaza suavemente la vista al fijar, adapta el
desplazamiento al ancho de pantalla y amplía distancia para enemigos lejanos,
conservando colisión.

## Progresión

Dos checkpoints: después de los dos Brotes y al desbloquear la puerta antes
del Guardián. El inicio es punto de aparición, no un tercer checkpoint. Un sello
de raíces libera el sendero al terminar el primer combate. Espíritu → interruptor
→ reja → cofre → llave → interacción de puerta → Guardián → interacción de altar.
La última interacción inicia tres segundos de restauración y la victoria.

`SaveStore` valida versión, tipos e invariantes entre llave/cofre/reja/puerta,
checkpoints y victoria. Los datos corruptos se rechazan con aviso. No se guardan
coordenadas arbitrarias ni salud parcial del jefe: continuar usa checkpoint y
restaura los enemigos aún vivos. Autosave periódico y en eventos importantes.

## Arte, recursos y rendimiento

Las referencias 2D se conservan fuera de `public/`. Geometría original de árboles,
raíces, ruinas, vegetación y personajes; texturas de pigmento, corteza, tela y
piedra generadas localmente en canvas. Mallas estáticas combinadas por material;
piezas rígidas de personajes combinadas por nodo articulado y material. Materiales
reutilizados, sombra direccional configurable, fog y far plane limitado. Se
eliminan proyectiles al expirar. Audio desconecta nodos al terminar.

El catálogo marca modelos provisionales procedurales con `modelPath: null`.
Si se configura un GLB, `VisualOverrides` lo carga debajo de la raíz visual,
oculta las piezas procedurales y asigna clips lógicos. Fallos de carga conservan
el provisional y registran aviso. No hay GLB de personajes real que validar aún.

La aplicación libera listeners, escena, motor y audio en HMR. En desarrollo,
`?test=1` expone `window.__veylun` para inspección de QA. Esta ruta está eliminada
por `import.meta.env.DEV` en compilación de producción; no existe en el build.
