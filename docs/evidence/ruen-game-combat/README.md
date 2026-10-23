# Evidencia de guardia, bloqueo y combo equipado

Revisión iniciada el 22 de octubre de 2026, fecha de America/Monterrey.
**173 unitarias y 40 casos únicos de navegador aprobados; publicado desde `f828d841`.**

[Alcance de la etapa](../../RUEN_GAME_COMBAT.md).

El trabajo adapta guardia, reacción al bloqueo y tres ataques al modelo real
con espada y escudo. Se mantiene la reducción del escudo del 30% y se conservan
las ventanas de combate existentes. Los nuevos clips se crean en memoria;
los cinco GLB conservan sus hashes y los 20 clips originales del master.

## Resultados de unidad y build

- **173 pruebas unitarias en 17 archivos**, aprobadas en 3.24 s: [log](unit.log).
- Typecheck y build aprobados: [log](build.log). El build mantiene el aviso
  conocido de chunks grandes de Babylon.
- [SHA-256 de los cinco GLB](asset-hashes.json) cotejados con los inventarios
  guardados en la fuente publicada `50210a9c`: todos coinciden.

Estos resultados corresponden a la fuente final con las correcciones de la
primera tanda de navegador. Incluyen una regresión de reproducción real que
fallaba con `CONSTANT` y pasa con `CYCLE`. La comprobación inicial de 172
unitarias y su build fueron anteriores a estos ajustes.

## Siete casos nuevos de navegador aprobados

La ejecución corregida aprobó **7/7 casos**, con un intento por caso y cero
omitidos, fallos o resultados inestables. Comenzó en
`2026-10-23T04:45:49.755Z` y duró **408,808.963 ms: 6 min 48.809 s**.
[Resumen compacto](new-browser-summary.json) · [log](new-browser.log).

- Combo con [teclado](equipped-combo-keyboard.json), [ratón](equipped-combo-mouse.json)
  y [mando simulado](equipped-combo-gamepad.json): salud del Guardián
  **12 → 11 → 10 → 8**, conservando daño 1/1/2. En 16 muestras de ataque por
  dispositivo, el error entre fotograma y `attackTime × 60` fue **0**.
- El error máximo de agarre durante ataques fue `1.1355819031566635e-5`;
  entre todos los renders jugables fue `1.6010260304676368e-5`. Ambos quedan
  por debajo de la tolerancia `1e-4`.
- [Guardia y bloqueo](equipped-guard-block.json): salud conservada en **10**,
  un evento de bloqueo y cuatro muestras de guardia en movimiento con objetivo.
- [Pausa e interrupciones](equipped-combat-interruptions.json): la pausa
  conserva el ataque en 0.2 s y el fotograma 12. Esquiva y daño cancelan el
  ataque, ocultan el equipo y usan el rig provisional; después vuelve la
  guardia equipada. El golpe del Brote baja la salud de 10 a 9 sin generar
  impactos de espada.
- [Visor de desarrollo](combat-preview-evidence.json): clips propios,
  repetición, controles e inventario. La prueba de producción comprueba DOM,
  controles y [solicitudes de los tres GLB](production-combat-preview-console.json),
  sin hooks de desarrollo.

Los cinco registros de consola de gameplay están vacíos, igual que errores
y promesas no controladas del [visor](combat-preview-console.json) y de
[producción](production-combat-preview-console.json).

Las capturas desde los controles corresponden al servidor de desarrollo:
[guardia frontal](equipped-combat-interruptions-shield.png),
[bloqueo](equipped-guard-block-block.png) y combo con teclado
([ataque 1](equipped-combo-keyboard-attack1.png),
[ataque 2](equipped-combo-keyboard-attack2.png),
[ataque 3](equipped-combo-keyboard-attack3.png)). Las de ataque capturan el
primer fotograma activo; no muestran por sí solas la trayectoria completa
ni la elevación máxima del tercer golpe.

El visor de desarrollo se conserva de [frente](ruen-combat-guard-front.png) y
de [lado](ruen-combat-guard-side.png). La prueba de producción no generó una
captura PNG separada. La auditoría manual de abajo complementa estos registros
con poses de preparación y trayectoria.

## Primera tanda de navegador

Los siete casos nuevos terminaron con **3 aprobados y 4 fallidos** en
365,099.253 ms, aproximadamente 6.1 minutos. Los hallazgos fueron:

- El visor dejaba inmóviles los clips de bloqueo y ataque al repetirlos porque
  usaban `CONSTANT`. Los cinco grupos propios ahora usan `CYCLE`. La regresión
  con reproducción real falló antes del cambio y pasa tras él, comprobando
  las vueltas siguientes.
- Los tres casos del combo superaron la tolerancia del agarre de `1e-5`:
  el máximo fue `1.1355819031566635e-5`, igual en los tres casos, por precisión
  Float32 en la escena situada alrededor de Z=112. La tolerancia se ajustó a
  `1e-4`, con un comentario que explica la magnitud y el motivo.

Los tres combos llegaron a ejecutar daño real de 12 → 11 → 10 → 8 y sus
capturas son válidas, pero los casos completos fallaron por aquella aserción.
Guardia/bloqueo y pausa/esquiva/daño aprobaron. Ningún resultado parcial se
presenta como aprobación de la suite. Los artefactos de esta primera tanda
se conservan en el directorio de validación de la sesión, separados de la
ejecución corregida de siete casos documentada arriba.

## Calibración manual de poses

Se revisaron guardia, bloqueo y los tres ataques sobre la malla real, con
vistas frontal y lateral y sin errores de página. El muestreo de ataques a
60 fps mantuvo toda la espada por encima del suelo: mínimo Y aproximado de
0.08964 en las unidades del modelo. Se amplió el encuadre para incluir la
punta durante el golpe alto. La guardia móvil se revisó manualmente hacia
adelante, atrás, izquierda y derecha, sin errores de página.

Capturas de esta auditoría: [guardia frontal](calibration-guard-front.png),
[impacto del primer ataque de lado](calibration-attack1-impact-side.png),
[preparación del golpe alto](calibration-attack3-ready-front.png) y
[guardia hacia la izquierda](calibration-guard-left-side.png).
Son poses y estados seleccionados para calibración; no prueban por sí solos
la ejecución de ataques, bloqueo o movimiento desde los controles.

## Cierre de regresión y resultado completo

La regresión aprobó **32 de 33 casos** en **1,780,410.323 ms: 29 min 40.410 s**,
con un intento por caso y sin omitidos ni resultados inestables.
[Resumen de regresión](regression-browser-summary.json) · [log](regression-browser.log).
El único fallo fue el caso del Idle con rig incompatible: esperaba
«Prototipo Idle no disponible…» y la interfaz muestra «Animación propia no
disponible…». Se corrigió únicamente esa expectativa del test.

La repetición aislada aprobó todas las comprobaciones de ese caso en
**2,720.107 ms**, sin omisiones ni reintentos automáticos.
[Resumen de la repetición](copy-retest-summary.json) · [log](copy-retest.log).
La comparación de la fuente confirmó que sólo cambió ese literal del test;
la aplicación, los assets y el build permanecieron intactos.

El resultado final es **40 casos únicos aprobados**: siete nuevos, 32
regresiones aprobadas inicialmente y un caso repetido. El
[resumen conjunto](validation-summary.json) conserva las tres tandas y la
repetición; no representa dos tandas limpias ni 41 casos distintos.

Estas pruebas usan Chromium con SwiftShader
y servidores locales de desarrollo y producción; no miden FPS en el equipo
del usuario ni prueban un mando físico o el sitio público.

La validación anterior de `50210a9c` —152 unitarias y 33 de navegador— permanece
en [su propia ficha](../ruen-game-equipment/README.md).

## Publicación

El [PR #5](https://github.com/Dabot11/Veylun/pull/5) integró la revisión probada
`5db6021cb74a00042fb9b1c4b8c56f28a8bac702`. La fuente publicada
`f828d84120b1df74a25ac51c62dbaf9666c9d866` tiene exactamente el mismo árbol.
El commit de `gh-pages` es `8c4216ae69400623c02c3b747f6cd4297c43a7cd`; su
`deployment.json` remoto confirma esa fuente y el build de
`2026-10-23T05:27:26.757Z`.
[Actions 39905860479](https://github.com/Dabot11/Veylun/actions/runs/39905860479)
terminó con **Success**, incluido el despliegue de Pages.

La confirmación procede de Actions y los metadatos del commit. El dominio
público sigue restringido desde este entorno; no se comprobó en navegador
remoto. Los cambios documentales posteriores no modifican el build publicado.
[Registro de despliegue](../../DEPLOYMENT.md).
