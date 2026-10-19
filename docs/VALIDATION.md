# Validación ejecutada — MVP y pulido del combate

Fecha local: 18 de octubre de 2026 (America/Monterrey); registros del entorno:
19 de octubre, UTC. Linux cloud, Node 24.19.0, npm 11.9.0 y Chromium del sistema
con renderizado de software.

| Comprobación | Resultado |
|---|---|
| Instalación npm y repetición con `npm ci` | Correctas en la preparación del entorno; lockfile conservado |
| TypeScript estricto y compilación Vite | Correctos; build estático en `dist/` |
| `npm test` | 58 pruebas aprobadas en 6 archivos |
| Playwright, `bootstrap.spec.ts`, build estático | 4 pruebas de inicio, controles, guardado y mando |
| Playwright, `scenarios.spec.ts`, desarrollo | 1 prueba de controles, entrada inmediata al iniciar, jefe y altar |
| Playwright, `combat.spec.ts`, desarrollo | 4 pruebas: daño real con teclado, ratón y Xbox simulado; bloqueo y contraataque con IA activa |
| Revisión visual nueva | Panel de vida, estado, flecha de embestida y encuadre a corta distancia en 800 × 600 y 390 × 844 |
| Referencias | 24 PNG originales conservados; inspección y hashes comprobados en la preparación inicial |
| Publicación | GitHub Pages desde `gh-pages`; ver `DEPLOYMENT.md` y Actions para la revisión publicada |

## Lógica y recorrido

Las 58 pruebas cubren timestep, carga de modelos, cámara, movimiento y colisiones,
salto, combo, escudo, esquiva, objetivos, los tres tipos de enemigo, progresión,
muerte, checkpoints, altar y guardado. Una prueba recorre el nivel completo
mediante comandos normales de movimiento, ataque e interacción hasta restaurar
el altar, sin conceder objetos, daño ni salud. Las pruebas aisladas sí crean
estados específicos para comprobar cada regla.

Las once regresiones de `COMBAT_FIXES.md` comprueban las transformaciones reales
de la espada y las ventanas de entrada. El pulido agrega ocho pruebas de combate
sobre alternancia, bloqueo, reacción, daño efectivo, selección y panel, además
de cuatro comprobaciones de cámara sobre órbita y encuadre. Ver `COMBAT_POLISH.md`.

El cargador se prueba con una jerarquía sintética; no se recibió ni probó un GLB
definitivo de personaje.

## Navegador

Las nueve pruebas aprobaron en 3,2 minutos con un solo worker. Las cuatro sobre producción
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

La instrumentación `?test=1` solo existe en desarrollo. Las capturas con estados
preparados no representan una partida completa jugada manualmente en navegador.

## Límites y rendimiento

La agrupación inicial redujo la escena de 410 a 216 mallas. Esta iteración añade
un pool de 24 partículas de impacto y dos flechas de embestida; los efectos
se reutilizan y desactivan al expirar. Los nodos de audio se desconectan al acabar.
Vite mantiene el aviso de chunks mayores de 500 kB: principal de aproximadamente
935 kB minificado / 230 kB gzip; cargador opcional de 768 kB / 180 kB gzip.
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
