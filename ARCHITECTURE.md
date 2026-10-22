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
| `world/SpiritView.ts` | Carga, dirección, recuperación y pool de cuatro proyectiles mágicos |
| `world/GuardianView.ts` | Sector frontal y círculo de área con las mismas medidas que el daño |
| `world/SanctuaryView.ts` | Guía del altar, onda y luces reutilizables, transición de iluminación |
| `enemies/types.ts` | Tipos de enemigo y estados |
| `enemies/spiritCombat.ts` | Tiempos compartidos del Espíritu, amenaza de disparo y contacto barrido |
| `enemies/guardianCombat.ts` | Tiempos y alcance compartidos del jefe, contacto y duración de restauración |
| `input` | Acciones abstractas y adaptadores de dispositivo |
| `camera/FollowCamera.ts` | Seguimiento, órbita, colisión y encuadre del objetivo |
| `progression` | Datos versionados, validación y almacenamiento local |
| `progression/guidance.ts` | Indicaciones por etapa y ruta de la luz alrededor del recinto del cofre |
| `assets/characters.ts`, `assets/ruen.ts` | Modelos originales y animaciones procedurales; Ruen con codos y rodillas |
| `assets/characterRig.ts` | Contrato del rig y fusión de mallas por articulación/material/atributos |
| `world/awakeningArt.ts` | Decoración estática del claro, fusionada por material y atributos en WorldView |
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
elimina ataques; al derrotar al Espíritu también se disipan sus proyectiles.

Los Brotes comparten un turno de preparación/embestida y una separación de
350 ms entre ataques. Un bloqueo frontal pasa directamente a recuperación.
Los enemigos ordinarios pausan su estado 120 ms al recibir un golpe, o 240 ms
con el tercero del combo; el Guardián conserva su ritmo. El evento de impacto
incluye enemigo, daño efectivo y posición para sincronizar HUD, sonido y
partículas. El destello usa overlays por malla, sin alterar materiales compartidos.

El Espíritu prepara magia durante 950 ms y fija la dirección a los 500 ms.
El proyectil viaja recto a 4,2 m/s; la recuperación dura 2,8 s sin desplazamiento.
No inicia la carga sin línea de visión. La colisión de magia barre el segmento
completo, amplía los obstáculos por su radio y resuelve el contacto más temprano
con pared o jugador. La altura del obstáculo, la orientación del escudo y la
ventana de invulnerabilidad de la rodada se conservan. El HUD avisa de un disparo
entrante hasta que pasa, se esquiva a un lado, se bloquea o choca.

El Guardián alterna sector frontal bloqueable y área circular no bloqueable.
Simulación, poses y señales usan `guardianAttack`. El daño se aplica una vez en
el instante de impacto y respeta cobertura. Salir de la arena cancela la
preparación; reentrar exige un aviso completo. Las recuperaciones de 1,9 y 2,4 s
permiten responder con el combo. La cámara amplía el encuadre para el jefe,
con o sin fijación. Ver `docs/GUARDIAN_ENCOUNTER.md`.

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
Tras vencer al Espíritu, `ruinsSwitchReady` deriva del guardado existente y
enciende el haz del interruptor. Se apaga al activarlo; cargar una partida con
el Espíritu derrotado conserva la guía. La reja sigue requiriendo interacción.

`altarReady` deriva del progreso del jefe. `restorationProgress` devuelve el
avance de los tres segundos de ceremonia o uno para partidas completadas.
Vista y HUD lo consumen sin imponer victoria. La ceremonia termina en el modo
`won`; una partida nueva restaura iluminación y oculta los efectos anteriores.
`respawn` conserva los modos de restauración y victoria; el menú de pausa omite
el checkpoint durante la ceremonia. `zoneAt` resuelve la zona real al cargar y
reaparecer. El HUD limpia sus avisos temporales cuando cambia la aventura.

`objectivePosition` identifica el destino final. `guidancePosition` obtiene el
siguiente punto transitable alrededor del recinto de las ruinas; un grafo pequeño
de esquinas comprueba segmentos con `firstSolidHit` y margen de 0,36 m.
`WorldView` sitúa la luz sobre esa ruta. No cambia colisiones ni mueve al jugador.

`SaveStore` valida versión, tipos e invariantes entre llave/cofre/reja/puerta,
checkpoints y victoria. Los datos corruptos se rechazan con aviso. No se guardan
coordenadas arbitrarias ni salud parcial del jefe: continuar usa checkpoint y
restaura los enemigos aún vivos. Autosave periódico y en eventos importantes.
Una copia aislada en memoria mantiene el progreso de la sesión aun si la lectura,
escritura o eliminación del almacenamiento falla. Los avisos distinguen esta
continuidad de la persistencia después de cerrar/recargar. `Application` solo
guarda al abandonar la página si el jugador ha iniciado una aventura.

## Arte, recursos y rendimiento

Las referencias 2D se conservan fuera de `public/`. Geometría original de árboles,
raíces, ruinas, vegetación y personajes; texturas de pigmento, corteza, tela y
piedra generadas localmente en canvas. Mallas estáticas combinadas por material;
piezas rígidas de personajes combinadas por nodo articulado y material. Materiales
reutilizados, sombra direccional configurable, fog y far plane limitado. Se
eliminan proyectiles lógicos al expirar y se reutilizan sus mallas. Audio
desconecta nodos al terminar.

El catálogo marca modelos provisionales procedurales con `modelPath: null`.
Si se configura un GLB, `VisualOverrides` lo carga debajo de la raíz visual,
oculta las piezas procedurales y asigna clips lógicos. Fallos de carga conservan
el provisional y registran aviso.

La revisión actual carga Meshy por defecto en `/`; `?ruen=meshy` es un
alias y `?ruen=provisional` recupera el rig anterior. Usa el master real mediante
`RuenLocomotionView`: un contenedor exterior independiente sigue al controlador
y conserva completa la jerarquía importada. Sólo Walking/Running se mezclan
durante 0.2 s; su velocidad depende del desplazamiento real tras colisiones.
En reposo se restaura la pose base exacta y estática del GLB, sin clip Idle,
respiración ni offsets añadidos; la transición con locomoción dura 0.2 s.
Acciones sin clip validado y movimiento lateral/hacia atrás con objetivo
fijado conservan el rig provisional. Los menús pausan los clips y un bloqueo por
colisión los congela. Cámara, collider, daño, progresión y guardado siguen en la
simulación existente. El visor `?inspect=ruen` carga automáticamente el master,
queda pausado y permanece aislado de la simulación y del guardado. Pasaron
123 pruebas unitarias y 26 de navegador locales. La versión `2045061` de `main`
está publicada en GitHub Pages, confirmada mediante Actions.
Ver [inspección y límites](docs/RUEN_MESHY_INSPECTION.md).

La aplicación libera listeners, escena, motor y audio en HMR. En desarrollo,
`?test=1` expone `window.__veylun` para inspección de QA. Esta ruta está eliminada
por `import.meta.env.DEV` en compilación de producción; no existe en el build.
