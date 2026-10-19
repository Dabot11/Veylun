# Validación ejecutada — recorrido y continuidad

19 de octubre de 2026, UTC. Linux cloud, Node 24.19.0, npm 11.9.0 y Chromium
con renderizado de software. El entorno y las dependencias existentes se
reutilizaron; no hubo cambios de instalación ni de configuración cloud.

| Comprobación | Resultado de esta revisión |
|---|---|
| `npm test` | 102 pruebas aprobadas en 9 archivos |
| TypeScript estricto y build Vite | Correctos, incluido el ajuste final de orientación del cofre |
| Playwright, recorrido completo | 1 aprobada: Nueva partida → victoria, muerte deliberada y recargas; 8,3 min de ejecución |
| Playwright, continuidad aislada | 2 aprobadas: almacenamiento deshabilitado; controles iniciales y pausa de la restauración |
| Playwright, regresiones existentes | 10 aprobadas en 13,3 min: inicio, guardado, controles, ratón y Xbox simulado |
| Revisión visual | Inicio, guía de las ruinas y cofre; 800 × 600, 390 × 844 y 640 × 480, sin desbordamiento horizontal |
| Publicación | Ver `DEPLOYMENT.md` y GitHub Actions para la revisión publicada |

## Recorrido completo en navegador

`journey.spec.ts` empieza desde Nueva partida y realiza el recorrido con entradas
DOM de teclado. Un controlador de prueba observa posiciones, estados de combate
y la misma ruta usada por la luz guía. No llama a `sim.step`, teletransporta,
concede objetos ni modifica salud o daño en esa prueba.

La ejecución aprobada:

1. Vence a ambos Brotes y obtiene el primer checkpoint.
2. Recarga y continúa en el Sendero de las raíces.
3. Vence al Espíritu y activa explícitamente el interruptor.
4. Sigue la luz alrededor del muro, entra por la reja, abre el cofre y sale con
   la llave hasta abrir la puerta. Obtiene el segundo checkpoint.
5. Muere deliberadamente ante el Guardián. Comprueba regreso a z=85, salud 10/10,
   Guardián 12/12, una muerte registrada y llave conservada.
6. Recarga, continúa desde la Puerta del santuario, vence al jefe y comprueba que
   todavía no hay victoria.
7. Se acerca al altar, lo activa y termina la restauración. El guardado final
   contiene `completed: true` y una muerte.

El contador terminó en 78,4 segundos de simulación con un controlador que conoce
el nivel. **Esto no mide la duración para una persona ni valida la meta de
10–15 minutos.** La ejecución real duró 8,3 minutos por el renderizado de software.
Se usa el ajuste normal de sombras desactivadas, viewport 640 × 480 y el timestep
sin modificar. Las revisiones visuales estáticas mantienen sombras activadas.

Las dos pruebas de continuidad preparan estados específicos, por separado:
una bloquea incluso el acceso a `localStorage` y comprueba aviso, menú,
continuación y confirmación de reinicio; otra comprueba que abrir controles
antes de comenzar no cree un guardado y que la ceremonia se pueda pausar,
reanudar y completar sin ofrecer el retorno al checkpoint.

Los primeros intentos del recorrido detectaron problemas del ensayo: una
recarga de Vite durante un cambio local, un límite de aserción de cinco segundos
insuficiente para el renderizado y una parada que intentaba cruzar el cuerpo del
Guardián antes de la muerte deliberada. Se repitió la prueba desde cero tras
corregir el ensayo. No se ajustaron salud, IA, daño ni ventanas del juego para
hacerla pasar.

El giro visual del cofre se hizo después de ese recorrido y se verificó en las
capturas finales y el build; no modifica la simulación ni el recorrido.

## Lógica, persistencia y controles

Las 102 pruebas incluyen el recorrido íntegro en simulación y las regresiones
anteriores de espada, movimiento, cámara, objetivos, escudo, esquiva, enemigos,
proyectiles, checkpoints, modelos y altar. Las once nuevas comprueban:

- Zona correcta al cargar y reaparecer; conservación del progreso parcial al morir.
- Imposibilidad de salir de restauración/victoria mediante `respawn`.
- Progreso de sesión ante fallos de lectura, escritura y borrado; reintento de
  escritura y aislamiento de la copia devuelta al consumidor.
- Rutas transitables hacia el cofre desde tres lados y salida hasta la puerta,
  usando movimiento y colisiones normales.

Las pruebas anteriores del combate se describen en `COMBAT_FIXES.md`,
`COMBAT_POLISH.md`, `SPIRIT_ENCOUNTER.md` y `GUARDIAN_ENCOUNTER.md`.
`JOURNEY_POLISH.md` documenta esta revisión. Los encuentros aislados sí preparan
estados para comprobar cada regla; no equivalen al recorrido desde Nueva partida.

La instrumentación `?test=1` solo existe en desarrollo. Las pruebas de inicio
usan el build estático; las de encuentros y recorrido utilizan desarrollo.
Los mandos se simulan mediante la Gamepad API; no se conectó un Xbox físico.

En total aprobaron **13 pruebas de navegador** en ejecuciones separadas. El lote
de regresiones incluye cuatro de `bootstrap.spec.ts`, dos ataques con ratón/mando,
carga de victoria y nuevo inicio, encuentro del Guardián con mando, controles y
altar, y encuentro del Espíritu con mando. No se repitieron los otros cuatro
casos existentes: ataque con teclado, Brote activo, Espíritu con teclado y
Guardián con teclado. Los tres enemigos sí se recorrieron con teclado en la
nueva prueba completa desde el inicio.

## Límites

El build conserva el aviso de chunks mayores de 500 kB: aproximadamente 953 kB
minificados / 235 kB gzip para el principal y 768 kB / 180 kB gzip para el cargador
opcional de modelos. No impide compilar. No se midieron 60 FPS en macOS ni la
mezcla de sonido con altavoces físicos.

Pendientes: recorrido humano en Chrome/macOS, Xbox físico, dificultad y duración
con jugadores. Los modelos, animaciones y escenario son provisionales y
simplifican las 24 referencias PNG conservadas. No se recibió un GLB definitivo;
el cargador se prueba con una jerarquía sintética.

El acceso directo a `dabot11.github.io` está bloqueado por la política de la red
cloud. La publicación se verifica mediante GitHub Actions, las revisiones de
`main`/`gh-pages` y el manifiesto `deployment.json`.

## Repetir

```sh
npm test
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- --workers=1
```

Playwright inicia preview en 4173 y desarrollo en 5174. Si no hay Chromium del
sistema, ejecutar `npx playwright install chromium` y omitir la variable.

Durante el onboarding se guardaron `install_script` y `start_skill`. No se
modificaron en esta revisión ni se comprobó su restauración en otra tarea.
