# Validación ejecutada — Guardián y restauración del santuario

Fecha local: 18 de octubre de 2026 (America/Monterrey); registros del entorno:
19 de octubre, UTC. Linux cloud, Node 24.19.0, npm 11.9.0 y Chromium del sistema
con renderizado de software.

| Comprobación | Resultado |
|---|---|
| Instalación npm y repetición con `npm ci` | Correctas en la preparación del entorno; lockfile conservado |
| TypeScript estricto y compilación Vite | Correctos; build estático en `dist/` |
| `npm test` | 91 pruebas aprobadas en 8 archivos |
| Playwright, `bootstrap.spec.ts`, build estático | 4 aprobadas en la revisión anterior `f0cdd96`; no repetidas en esta iteración |
| Playwright, `scenarios.spec.ts`, desarrollo | 1 prueba de controles, entrada inmediata al iniciar, jefe y altar |
| Playwright, `guardian.spec.ts`, desarrollo | 3 aprobadas: dos encuentros completos con teclado/Xbox simulado; carga de victoria y reinicio visual |
| Playwright, `combat.spec.ts`, desarrollo | 4 aprobadas en `f0cdd96`; no repetidas en esta iteración |
| Playwright, `spirit.spec.ts`, desarrollo | 2 aprobadas en `f0cdd96`; no repetidas en esta iteración |
| Revisión visual | Guardián, sector frontal, círculo de suelo, encuadre, guía del altar y ceremonia; escritorio y pantalla estrecha |
| Referencias | 24 PNG originales conservados; inspección y hashes comprobados en la preparación inicial |
| Publicación | GitHub Pages desde `gh-pages`; ver `DEPLOYMENT.md` y Actions para la revisión publicada |

## Lógica y recorrido

Las 91 pruebas cubren timestep, carga de modelos, cámara, movimiento y colisiones,
salto, combo, escudo, esquiva, objetivos, los tres tipos de enemigo, progresión,
muerte, checkpoints, altar y guardado. Una prueba recorre el nivel completo
mediante comandos normales de movimiento, ataque e interacción hasta restaurar
el altar, sin conceder objetos, daño ni salud. Las pruebas aisladas sí crean
estados específicos para comprobar cada regla.

Las once regresiones de `COMBAT_FIXES.md` comprueban las transformaciones reales
de la espada y las ventanas de entrada. El pulido agrega ocho pruebas de combate
sobre alternancia, bloqueo, reacción, daño efectivo, selección y panel, además
de cuatro comprobaciones de cámara sobre órbita y encuadre. Ver `COMBAT_POLISH.md`.

Las quince pruebas nuevas del Espíritu verifican preparación y dirección fija,
retirada mirando a Ruen, cobertura, bloqueo seguido de contraataque desde seis
metros, colisiones barridas y prioridad de contacto, altura, escudo frontal y
trasero, esquiva, salto, aviso de peligro, limpieza al morir, progreso del
interruptor y estabilidad del pool de mallas. Ver `SPIRIT_ENCOUNTER.md`.

Las dieciocho pruebas del Guardián añaden alternancia, instante del impacto,
escudo, geometría del ataque, rodada, salto, cobertura, reentrada a la arena,
combo real en recuperación, muerte, persistencia, ceremonia, efectos reutilizables
y encuadre con y sin fijación. Ver `GUARDIAN_ENCOUNTER.md`.

El cargador se prueba con una jerarquía sintética; no se recibió ni probó un GLB
definitivo de personaje.

## Navegador

En esta iteración aprobaron cuatro pruebas de navegador: los dos encuentros
completos del Guardián (5,2 min juntos), la carga de una victoria seguida de nueva
aventura (19,5 s de prueba) y la regresión existente de controles/jefe/altar.
No se repitieron las demás pruebas de navegador de la revisión anterior.

Los combates conservan salud e IA normales del jefe. Entradas de teclado o Xbox
simulado bloquean dos ataques frontales, salen del círculo del golpe al suelo,
encadenan tres combos y activan el altar. Verifican salud 10/10, daño real 12 → 8
→ 4 → 0, ausencia de victoria automática, guía, ceremonia, victoria y persistencia.
La prueba adicional detecta una reaparición visual del jefe ya derrotado y
verifica su corrección al cargar, además del reinicio de iluminación en nueva partida.

El renderizado usa Chromium con SwiftShader, 640 × 480 y el ajuste normal de
sombras desactivadas. Las pulsaciones del combo se coordinan con los frames de
animación mediante eventos DOM o Gamepad API; esperar el HUD o varios viajes
al proceso de pruebas podía exceder la ventana del combo. No se cambian el
timestep, salud, daño ni ventanas de entrada para facilitar estas pruebas.
Las revisiones visuales estáticas también usan sombras activadas.

### Resultados de la revisión anterior

En la revisión anterior `f0cdd96`, las once pruebas aprobaron en ejecuciones separadas: dos del Espíritu (4,3 min),
ocho regresiones en el lote general (9,3 min, que incluyó un timeout) y la
repetición del inicio con su límite ampliado (2,6 min). Todas usaron un solo worker.

Las cuatro pruebas sobre producción
verifican inicio, controles, cámara, pausa, ajustes, HUD adaptable, guardado
corrupto, recarga de progreso, confirmación de nueva partida y Gamepad API con
un Xbox estándar simulado. No se conectó un mando físico.

La prueba de controles y altar reproduce una tecla recibida en el mismo evento
de inicio, antes del primer frame de juego. Detectó y permitió corregir una
entrada descartada por usar el estado de menú del frame anterior. Comprueba
movimiento, salto, escudo y fijación. Después prepara un estado avanzado para
revisar el Guardián y el altar: no hay victoria antes del jefe ni por derrotarlo;
la interacción inicia la restauración y muestra la victoria.

Tres pruebas de combate generan pulsaciones de teclado, ratón o flancos de un
mando simulado. Con un enemigo situado a alcance y en recuperación, verifican
salud 3 → 2 → 1 → 0, barra de vida, confirmación de impacto y muerte registrada.
No se concede daño desde la preparación del escenario. La cuarta acerca a
Ruen al encuentro y conserva la IA normal: fija con Q, bloquea con K y responde
con J, sin perder salud. Comprueba además la limpieza del panel al volver al
checkpoint. Las pruebas vigilan errores de página; las de inicio y altar
vigilan también consola.

Las dos pruebas del Espíritu aprobaron en 4,3 minutos con un solo worker.
Preparan únicamente el progreso previo de los Brotes y la posición inicial de
Ruen; conservan IA y salud normales del Espíritu. Teclado o mando simulado
bloquean la magia, se acercan, causan dos golpes, derrotan al enemigo y activan
el interruptor. Comprueban salud intacta, desaparición de proyectiles, mensajes,
señal del cristal y apertura de la reja. No conceden daño desde la preparación.

Con SwiftShader, los encuentros usan el ajuste normal de sombras desactivadas.
Las pruebas de inicio y Brotes mantienen sombras activadas. Los límites de tiempo
permiten el renderizado lento por software: una primera ejecución del inicio
agotó 90 segundos durante movimientos del ratón; se amplió a 180 segundos sin
cambiar sus comprobaciones. El tiempo de ejecución de estas pruebas no equivale
a la duración de una partida con GPU.

La instrumentación `?test=1` solo existe en desarrollo. Las capturas con estados
preparados no representan una partida completa jugada manualmente en navegador.

## Límites y rendimiento

La agrupación inicial redujo la escena de 410 a 216 mallas. Esta iteración añade
un pool de 24 partículas de impacto, dos flechas de embestida, cuatro disparos
reutilizables y señales de carga, recuperación e interruptor; los efectos
se reutilizan y desactivan al expirar. Los nodos de audio se desconectan al acabar.
El Guardián añade sectores y aros reutilizables; la restauración reutiliza una
onda y ocho luces. Vite mantiene el aviso de chunks mayores de 500 kB: principal de aproximadamente
950 kB minificado / 234 kB gzip; cargador opcional de 768 kB / 180 kB gzip.
El build concluye correctamente. Estas comprobaciones no demuestran 60 FPS en
macOS ni validan la mezcla de sonido con altavoces físicos.

Pendientes: Xbox físico, recorrido completo manual en Chrome/macOS, duración de
10–15 minutos y ajuste de dificultad con jugadores. Los modelos, animaciones y
escenario son provisionales y simplifican las referencias. El acceso directo a
`dabot11.github.io` está bloqueado por la red cloud; la publicación se verifica
mediante el estado de GitHub Actions y las revisiones de las ramas.

## Repetir

```sh
npm test
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- --workers=1
```

Playwright inicia preview en 4173 y desarrollo en 5174. Si no hay Chromium del
sistema, ejecutar `npx playwright install chromium` y omitir la variable.

Se guardaron `install_script` y `start_skill` en el borrador del entorno durante
la preparación inicial. Esto no publica la configuración y no se ha comprobado
su restauración en otra tarea. `docs/DEPLOYMENT.md` documenta la publicación web.
