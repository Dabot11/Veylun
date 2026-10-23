# Validación ejecutada

## Acciones restantes: validadas; publicación pendiente

Aprobaron typecheck, build y **234 pruebas unitarias en 20 archivos** en 5.67 s.
El build terminó en 861 ms y conserva el aviso conocido sobre chunks grandes.
Se mantienen los cinco GLB y los 20 clips originales; el conjunto tiene
22 clips propios, 42 grupos en gameplay y 43 en el visor `actions-v1`.

La calibración aislada revisó 523 poses a 60 Hz de los diez clips nuevos,
sin errores de página. Tras corregir los contactos iniciales de capa y pies,
la calibración del adaptador aprobó 915 muestras de diez escenarios: ningún
fallback, desplazamiento adicional de raíz ni penetración superior a la
tolerancia de 0.01. El mínimo respecto al suelo fue −0.0007373 unidades.
Son auditorías de contacto; no equivalen a comprobar los controles.

Aprobaron **13 casos seleccionados de 51**, con 11 de desarrollo y dos de
producción: siete nuevos y seis regresiones. Doce aprobaron al primer intento.
El caso de escudo ausente leyó `isPlaying` antes de reanudarse la reproducción;
se corrigió la espera del test, se conservó su aserción y aprobó la repetición
aislada. La aplicación y el build no cambiaron. El recorrido completo
`journey` aprobó con 79.0 s simulados y una muerte deliberada.

**Publicación pendiente.** La fuente pública vigente sigue siendo `b83b0f36`.
[Alcance](RUEN_COMPLETE_ACTIONS.md) ·
[Evidencia y correcciones](evidence/ruen-complete-actions/README.md).

## Salto y voltereta equipados: validado y publicado

Aprobaron typecheck, build y **197 pruebas unitarias en 18 archivos** en 4.56 s.
La etapa añade subida, caída, aterrizaje y voltereta sobre el rig real, sin
cambiar los cinco GLB, los tiempos de simulación ni la invulnerabilidad.

La calibración manual corrigió penetraciones iniciales de pies/capa. La prueba
posterior de transición corrigió la mezcla de pelvis/piernas al entrar en la
voltereta; sus 130 muestras finales quedaron dentro de 0.01 unidades de
tolerancia de contacto. Estas auditorías complementan las pruebas desde
controles. Aprobaron **22 casos únicos seleccionados de navegador: 15 de
desarrollo y siete de producción**. Los cuatro nuevos cerraron con tres
aprobados inicialmente y Shift aprobado tras corregir sólo el filtro que
comparaba su posición con Idle. La aplicación y el build no cambiaron. Las
18 regresiones aprobaron sin omitidos ni resultados inestables.

La selección no repite la suite completa de 44 casos, `journey` ni los
encuentros de enemigos restantes. Incluye caída sin impulso desde una altura
preparada. Publicación confirmada por
[Actions 39914027016](https://github.com/Dabot11/Veylun/actions/runs/39914027016),
tras integrar el [PR #6](https://github.com/Dabot11/Veylun/pull/6): fuente
`b83b0f365e84555de195466c9d6f2c8aaad79dcf`, árbol idéntico al probado
`a0384329a161faf414aba265c88ade1f37c1d975`, build de `gh-pages`
`df6b2d858e945fdd893b0be42a0e1a01426f1a51`.
[Alcance](RUEN_GAME_TRAVERSAL.md) ·
[Evidencia](evidence/ruen-game-traversal/README.md).

## Guardia, bloqueo y combo equipado: validado y publicado

22 de octubre de 2026, fecha de America/Monterrey. La nueva etapa adapta la
defensa y los tres ataques al Ruen real con su equipo actual. Conserva los
tiempos de combate y la reducción del escudo del 30%. Las animaciones se crean
sobre el esqueleto existente; la simulación sigue decidiendo daño y movimiento.

Tras corregir los hallazgos iniciales aprobaron **173 pruebas unitarias en
17 archivos** en 3.24 s, typecheck y build. La comprobación inicial había
aprobado 172 unitarias antes de esas correcciones.
El build conserva el aviso conocido de chunks grandes de Babylon. La auditoría
manual de poses revisó guardia, bloqueo y los tres ataques en frontal/lateral;
el muestreo a 60 fps mantuvo la espada por encima del suelo, sin errores de
página. No equivale a una prueba del combate desde los controles.

La guardia móvil se calibró manualmente en cuatro direcciones, sin errores de
página. Los cinco GLB coinciden por SHA-256 con los inventarios de la fuente
publicada `50210a9c`.

La primera tanda de siete casos nuevos de navegador terminó con **3 aprobados
y 4 fallidos** en 365,099.253 ms. Detectó que el visor congelaba bloqueo y
ataques al repetir clips `CONSTANT`, y que tres aserciones de agarre usaban una
tolerancia inferior al error Float32 medido. Los cinco grupos usan ahora
`CYCLE`; una regresión con reproducción real falló antes del cambio y pasa
después. La tolerancia quedó en `1e-4`, frente al máximo observado de `1.1356e-5`.
Los combos sí aplicaron daño 12 → 11 → 10 → 8, pero sus casos completos fallaron.
Tras las correcciones, los **siete casos nuevos aprobaron** en 408,808.963 ms
(6 min 48.809 s), sin omisiones ni reintentos. Los tres dispositivos ejecutaron
daño 12 → 11 → 10 → 8 y coincidencia exacta entre el fotograma y `attackTime × 60`.
La regresión terminó con **32 de 33 aprobados** en 1,780,410.323 ms
(29 min 40.410 s). El caso del Idle con rig incompatible falló al esperar el
texto antiguo «Prototipo Idle no disponible…» en lugar de «Animación propia
no disponible…». Se ajustó sólo esa expectativa y el caso aislado aprobó
todas sus comprobaciones en **2,720.107 ms**. La aplicación y el build
permanecieron intactos.

El cierre suma **40 casos únicos aprobados**: siete nuevos, 32 regresiones
aprobadas inicialmente y una repetición aislada. Son tres tandas de cierre,
con el fallo de texto y su repetición registrados, no dos tandas limpias.
Publicación confirmada por [Actions 39905860479](https://github.com/Dabot11/Veylun/actions/runs/39905860479),
tras integrar el [PR #5](https://github.com/Dabot11/Veylun/pull/5). Fuente
`f828d84120b1df74a25ac51c62dbaf9666c9d866`, con árbol idéntico a la revisión
probada `5db6021cb74a00042fb9b1c4b8c56f28a8bac702`; commit de `gh-pages`
`8c4216ae69400623c02c3b747f6cd4297c43a7cd`. [Registro de despliegue](DEPLOYMENT.md).
Las 152 pruebas unitarias y 33 casos de `50210a9c`
permanecen como resultados históricos. Logs y capturas de calibración en
[la evidencia de combate](evidence/ruen-game-combat/README.md).
[Alcance de la etapa](RUEN_GAME_COMBAT.md).

## Idle y locomoción con equipo: validado y publicado

22 de octubre de 2026, fecha de America/Monterrey. La versión `50210a9c` integra el
Idle equipado y las adaptaciones de Walking/Running en la ruta normal del juego.
El escudo se reduce uniformemente un 30%, de escala 0.42 a 0.294, alrededor
del mismo punto de agarre. Los archivos originales se conservan y el juego
usa copias optimizadas; el visor sigue cargando los masters completos.

Typecheck, build, **152 pruebas unitarias en 16 archivos y 33 de navegador**
aprobaron. La suite completa usó un worker y terminó en **28.7 minutos**, en
una ejecución sin omisiones, fallos ni reintentos. El build conserva el aviso
conocido de Vite sobre chunks grandes. Se revisaron el escudo reducido en el
visor de frente y de lado, e Idle y Running desde controles en el juego.
Los registros de consola de gameplay y producción no contienen errores.

Las copias optimizadas quedaron revisadas y congeladas: **7,608,828 bytes y
122,930 triángulos**, frente a 44,478,640 bytes y 906,832 triángulos originales.
Se conservan los masters, los ejes y los agarres; las normales se hornearon
desde la superficie original hacia la malla reducida y se guardaron en PNG 1024²
sin pérdida para mantener el acabado. Color y metal/rugosidad usan JPEG 1024².
Dos exportaciones consecutivas produjeron archivos binariamente idénticos.
[Inventario final](evidence/ruen-game-equipment/runtime-inventory.json).

Las pruebas comprueban agarres, transiciones, pausa, bloqueo por colisión,
fallos de carga, regreso al rig provisional para acciones sin adaptar y el
build de producción sin hooks. La suite también recorre controles, combate,
guardado y restauración del santuario. Los resultados, capturas y límites de
esta ejecución local están en [la ficha de evidencia](evidence/ruen-game-equipment/README.md).
Publicación confirmada por
[Actions 39889821939](https://github.com/Dabot11/Veylun/actions/runs/39889821939):
fuente `50210a9c445e8851fa28df178b986c4651ff9f76`, árbol idéntico a la revisión
probada `272339ed60a8abb4f7d6dd6b5583bc974f41b397`, commit de `gh-pages`
`907deb03d65c8ead5e3b07f68b50292c4e90fc86`.
[Registro de despliegue](DEPLOYMENT.md) · [Alcance jugable](RUEN_GAME_EQUIPMENT.md).

## Prototipo anterior de Idle con equipo: validación local

22 de octubre de 2026. Se inventariaron los GLB reales de espada y escudo:
44,478,640 bytes y 906,832 triángulos en conjunto. Los originales conservan
sus SHA-256 y se identificaron el mango de la espada y el asa posterior del
escudo a partir de la geometría. El montaje se revisó en navegador de frente,
lado y espalda; la calibración terminó sin errores de aplicación. Se conserva
una [captura real en tres cuartos](images/ruen-equipped-idle.png). Esta revisión
visual no mide rendimiento ni sustituye la aprobación artística del usuario.

La ruta `?inspect=ruen&motion=idle-v1&equipment=azure` añade una variante
equipada sólo al visor. Tras el ajuste final de montaje aprobaron **142 pruebas
unitarias en 15 archivos**, typecheck y build. Aprobaron **10 casos únicos de
navegador** en dos ejecuciones sin reintentos ni cambios de aplicación: nueve
en 6.1 minutos y uno en 28.5 segundos. La primera incluye tres casos del equipo,
tres del Idle neutro y tres del visor sintético; la segunda revisa el master
real en el visor original. Incluyen desarrollo y build de producción locales.
Estos resultados de navegador no prueban el sitio remoto.

El equipo sigue las manos en los frames 0, 60 y 120, con loop cerrado y pies
inmóviles. Se comprobaron comparación con el Idle neutro, restauración de
poses originales, fallo/reintento sin recargar Ruen, liberación de recursos,
guardado intacto y ausencia de hooks en producción. No se repitió la suite
larga de aventura porque esta variante sólo cambia el visor.

Fuente publicada `15a6a6c52d224303e79a01e24255ee74b31cc2e4`, con el mismo
árbol que la revisión probada `bba241905e99869e2234a718f9c6c10096cb332c`.
Build `844381b13cde0f13289091479ccb6bac913a4249`.
[Actions 39868086193](https://github.com/Dabot11/Veylun/actions/runs/39868086193)
confirmó **Success** para ese build. La verificación pública se limita a
Actions y al `deployment.json` de `gh-pages`; el dominio público está
restringido desde este entorno.
[Inventario y alcance](RUEN_EQUIPMENT_PREVIEW.md) · [Evidencia visual](evidence/ruen-equipment/README.md).

## Primer Idle propio: prototipo del visor

22 de octubre de 2026. Typecheck/build correctos y **130 pruebas unitarias en
13 archivos aprobadas**. Se validaron **siete casos únicos de navegador**: cuatro aprobaron
inicialmente y tres se repitieron con éxito después de cerrarse el servidor de
desarrollo. No hubo cambios de código entre ejecuciones. Se comprobaron poses,
loop, pies inmóviles, controles, separación del inventario original, rig
incompatible y producción sin hooks. Capturas revisadas de frente, lado y espalda.

La revisión cambia sólo el visor y conserva el master y el gameplay. No se
repitió la suite larga de aventura; las pruebas de integración de este Idle
dentro del juego y la aprobación artística permanecen pendientes.

Fuente publicada `43fa18c4c5711cc8d861bec05018490190b2f4c3`; build
`41eed5cdd45c234990a0825ddcb54de12f4b4d25`.
[Actions 39853291990](https://github.com/Dabot11/Veylun/actions/runs/39853291990)
confirmó **Success**. La verificación pública se limita a Actions; las pruebas
de navegador usaron servidores locales.
[Evidencia y registros](evidence/ruen-idle-v1/README.md).

## Carga automática y reposo de Ruen

22 de octubre de 2026. **123 pruebas unitarias en 12 archivos y 26 de
navegador aprobadas**, estas últimas en una ejecución de 18.6 minutos sin
reintentos. Typecheck y build correctos. Chromium con renderizado de software,
servidores locales de desarrollo y producción; no es una medición de FPS.

La ruta normal carga Meshy automáticamente y conserva la pose base estática
en reposo. Se comprobó que la pose local vuelve exactamente a sus valores
iniciales después de correr y permanece estable. Las transiciones duran
0.2 s. El visor también carga automáticamente, con reproducción pausada.

La suite incluye 17 regresiones del MVP, tres casos del visor con fixture
sintético y seis de integración de Ruen: cuatro cargan el master real; los
otros verifican fallo de descarga y opt-out sin descargar el GLB. Incluye
producción sin hooks de depuración, locomoción, pausa, colisiones, acciones
provisionales, combate, aventura completa, muerte, checkpoints y guardado.

El master conserva su SHA-256. La pose base no es una animación Idle; salto,
esquiva, defensa y combate mantienen el rig provisional. Xbox físico y
rendimiento en el Mac de David quedan pendientes. Se mantiene el aviso de
chunk glTF mayor de 500 kB.

Se publicó la fuente `2045061ea5edffa5e93164ffe446b8034cf715dc` en `gh-pages`
como `99da774c01f0c797c25eb7a9361b4a0ecad0318c`.
[Actions 39839671135](https://github.com/Dabot11/Veylun/actions/runs/39839671135)
finalizó con **Success**. El merge conserva exactamente el árbol probado
`ad86656`. La verificación pública se limita a Actions: el dominio del sitio
no está accesible desde este entorno cloud.
[Juego](https://dabot11.github.io/Veylun/) ·
[Visor](https://dabot11.github.io/Veylun/?inspect=ruen).

[Evidencia y capturas](evidence/ruen-meshy/README.md) ·
[Log completo de esta revisión](evidence/ruen-meshy/default-idle-browser.log).

## Master real de Meshy y prueba de locomoción

22 de octubre de 2026. Typecheck y build correctos; **119 pruebas unitarias en
12 archivos y 24 pruebas de navegador aprobadas**. La suite de navegador pasó
en una ejecución de 11.8 minutos sin reintentos. Incluye el recorrido completo
del MVP, tres pruebas del visor con fixture sintético y cuatro con el GLB real.
Vite emitió un aviso de chunk del cargador glTF superior a 500 kB, sin fallo.

El master real conserva su hash. Se inventariaron 20 clips; sólo Walking y
Running se revisaron visualmente en tres vistas y se conectaron a la prueba
jugable `?ruen=meshy`, con el rig provisional para las demás acciones. No hay
aprobación final del arte ni del resto de clips. Xbox físico y FPS en el Mac
de David siguen sin probarse.

El build del código `6a80022d1eb3988da303e5de4e48a35aaa80c9f4` se publicó en
GitHub Pages como `ab38a2c85c4e1ac2e2fedc806fc0eae17ec8ec5f`.
[Actions 39832580525](https://github.com/Dabot11/Veylun/actions/runs/39832580525)
y su job **Deploy to GitHub Pages** finalizaron con **Success**.
Enlaces públicos: [prueba jugable](https://dabot11.github.io/Veylun/?ruen=meshy)
y [visor](https://dabot11.github.io/Veylun/?inspect=ruen).
La verificación pública se limita a Actions: la restricción de red del entorno
impidió comprobar el sitio remoto en navegador. Los tests anteriores se
ejecutaron contra los servidores locales del proyecto.

El [informe de inspección](RUEN_MESHY_INSPECTION.md) y la
[evidencia del master real](evidence/ruen-meshy/README.md) contienen resultados
y límites. Las secciones siguientes conservan el historial de validación
anterior a la incorporación de este GLB.

## Revisión artística de Ruen y del claro

19 de octubre de 2026. Mismo entorno cloud descrito abajo. Cambios de geometría,
articulación y decoración; controles, daño y progresión permanecen iguales.

- 106 tests unitarios en 10 archivos: incluye apoyo de pies y espada, guardia,
  limpieza de poses y flexión de carrera. La hoja se comprueba durante las
  ventanas de impacto de los tres golpes mirando en cuatro direcciones.
- TypeScript estricto y build Vite correctos.
- Capturas preparadas: frontal, espalda, carrera, ataque, escudo y rodada;
  claro a 800 × 600 y 390 × 844, sin desbordamiento horizontal.
- Nueve casos únicos de Playwright aprobados: cuatro de inicio/guardado/mando,
  tres ataques con teclado/ratón/Xbox simulado, Brote activo con bloqueo y
  contraataque sin daño al jugador, y controles con activación final del altar.

Los casos de navegador aprobaron en tres ejecuciones (5 + 3 + 1). Se repitieron
solo los fallidos por tiempos de espera. Se conservaron las comprobaciones de
daño, salud, guardado e interacción: las capturas de inicio se toman con la
pausa normal; combate/controles usan 640 × 480 y esperas mayores para software.
Teclado y mando de combate habían aprobado a 800 × 600. El inicio cubre
1280 × 720 y después 390 × 844. Las sombras permanecen activadas en los
encuentros y capturas de arte; el inicio también comprueba su desactivación
desde Ajustes. El último caso de controles/altar aprobó en 2,3 minutos.

No se repitieron en esta revisión los recorridos largos de Espíritu, Guardián
y aventura completa en navegador: sus resultados anteriores se conservan abajo.
La suite unitaria sí incluye sus reglas y el recorrido de simulación.

Las capturas inspeccionan arte y poses; no miden fluidez o FPS. Se detiene el
bucle después de renderizar cada pose para capturar en Chromium/SwiftShader.
Los primeros intentos de captura agotaron el tiempo bajo renderizado continuo;
no se interpretan como validación de rendimiento en hardware real.
Detalle de alcance en `ART_PASS.md`.

## Revisión anterior: recorrido y continuidad

19 de octubre de 2026, UTC. Linux cloud, Node 24.19.0, npm 11.9.0 y Chromium
con renderizado de software. El entorno y las dependencias existentes se
reutilizaron; no hubo cambios de instalación ni de configuración cloud.

| Comprobación | Resultado de la revisión anterior |
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

El build conserva el aviso de chunks mayores de 500 kB de Babylon; no impide
compilar. Las pruebas locales usan renderizado de software. No se midieron
FPS en Chrome/macOS del usuario ni la mezcla de sonido con altavoces físicos;
el mando Xbox es simulado, no hardware conectado.

Ruen y su espada/escudo usan los GLB reales recibidos y copias optimizadas del
equipo. Las pruebas cargan esos archivos; también se conservan fixtures
sintéticos para fallos y rigs incompatibles. Enemigos y escenario mantienen
recursos provisionales; el rig alternativo de Ruen queda como respaldo ante
errores o selección explícita. Siguen pendientes la
revisión artística con el usuario, la dificultad y la duración con jugadores.

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
