# Validación ejecutada — MVP

Fecha: 19 de octubre de 2026. Entorno: Linux cloud, Node 24.19.0,
npm 11.9.0 y Chromium del sistema con renderizado de software.

| Comprobación | Resultado |
|---|---|
| Instalación npm y repetición con `npm ci` | Correctas, lockfile utilizado |
| TypeScript estricto y compilación Vite | Correctos; build estático en `dist/` |
| `npm test` | 35 pruebas aprobadas en 4 archivos |
| Playwright, `bootstrap.spec.ts`, build estático | 4 pruebas aprobadas, 2,4 minutos |
| Playwright, `scenarios.spec.ts`, desarrollo | 1 prueba aprobada, 44,9 segundos |
| Errores de página/consola vigilados por las pruebas | Ninguno en las ejecuciones aprobadas |
| Revisión visual | Inicio, bosque, HUD, cámara del Guardián y victoria revisados |
| Referencias | 24 PNG inspeccionados; originales conservados y hashes verificados |

## Qué se comprobó

Las 35 pruebas de lógica cubren timestep, carga de modelos, cámara,
movimiento y colisiones, salto, combo, escudo, esquiva, objetivos,
los tres tipos de enemigo, progresión, muerte, checkpoints, altar y guardado.
Una prueba recorre el nivel completo mediante comandos normales de movimiento,
ataque e interacción hasta restaurar el altar, sin conceder objetos, daño
ni salud. Las pruebas aisladas sí crean estados específicos para comprobar
cada regla. El cargador de modelos se prueba con una jerarquía sintética;
no se recibió ni probó un GLB definitivo de personaje.

Las cuatro pruebas de navegador sobre producción verifican inicio, controles,
cámara, pausa, ajustes, HUD adaptable, guardado corrupto, recarga de progreso,
confirmación de nueva partida y Gamepad API con un Xbox estándar simulado.
No se conectó un mando físico.

La quinta prueba usa desarrollo para observar el estado de la simulación.
Comprueba movimiento, salto, escudo y fijación mediante teclado real del
navegador. Después prepara un estado avanzado para revisar el Guardián y el
altar: no hay victoria antes del jefe ni por derrotarlo; la interacción inicia
la restauración y muestra la victoria. Las capturas de esta prueba muestran
ese estado preparado, no una partida completa jugada en el navegador. La
instrumentación `?test=1` solo está disponible en desarrollo.

## Límites y rendimiento

La agrupación de geometría redujo la escena de 410 a 216 mallas. Vite mantiene
el aviso de chunks mayores de 500 kB: el principal ocupa aproximadamente
919 kB minificado / 225 kB gzip; el cargador opcional, 768 kB / 180 kB gzip.
El build concluye correctamente. Falta medir carga y rendimiento en hardware
real; estas comprobaciones no demuestran 60 FPS en macOS.

Pendientes: Xbox físico, recorrido completo manual en Chrome/macOS, duración
de 10–15 minutos y ajuste de dificultad con jugadores. Los modelos, animación
y escenario son provisionales y simplifican las referencias. No se publicó
el juego ni se validó una restauración del entorno en otra tarea.

## Repetir las comprobaciones

```sh
npm test
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Playwright inicia preview en 4173 y desarrollo en 5174. Si no hay Chromium
del sistema, ejecutar `npx playwright install chromium` y omitir la variable.
Las cinco pruebas se ejecutaron en dos invocaciones, una por archivo.

Se guardaron `install_script` y `start_skill` actualizados en el borrador del
entorno y la plataforma confirmó el guardado. Esto no publica la configuración.
Esta validación corresponde al MVP preparado para su primera publicación en
GitHub. El historial Git registra la versión publicada. `docs/DEPLOYMENT.md`
documenta la rama de publicación y los límites de verificación del hosting.
