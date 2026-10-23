# Veylun: El Santuario Olvidado

MVP de aventura 3D original para navegador, con un nivel de cinco zonas,
combate de espada/escudo, tres enemigos, acertijo, dos checkpoints y victoria
al restaurar el altar. Babylon.js + TypeScript estricto + Vite, sin backend.
Veylun, Ruen y el título del nivel son nombres de trabajo.

**[Jugar en Chrome](https://dabot11.github.io/Veylun/)** — publicado en GitHub Pages.

## Iniciar en Chrome

Node.js 24 LTS y npm:

```sh
npm install
npm run dev
```

Abre en Chrome la dirección que imprime Vite. Pulsa **Nueva partida**.
Activa la aceleración gráfica del navegador. Un clic en la escena captura el
ratón; si no está disponible, arrastra para girar la cámara. Escape pausa.

```sh
npm test
npm run build
npm run preview
```

El build comprueba TypeScript y genera `dist/` con rutas relativas. Se puede
servir en GitHub Pages o cualquier hosting estático. La publicación en la rama
`gh-pages` se realiza con `npm run deploy`; consulta `docs/DEPLOYMENT.md` para
la activación inicial y la verificación del sitio.
No se necesitan secretos, cuentas, CDN ni servicios durante el juego.

En el entorno cloud, usa `npm ci --cache /workspace/.cache/npm` para respetar
los permisos de escritura. Ver `docs/CLOUD_SETUP.md`.

## Ruen equipado: validado localmente

Esta revisión integra Idle, caminar y correr con espada y escudo en la ruta
normal `/`. Typecheck, build, **152 pruebas unitarias y 33 de navegador**
aprobaron. La publicación está pendiente; la versión pública sigue siendo
`15a6a6c`, que muestra el equipo sólo en el visor. Consulta el
[registro de despliegue](docs/DEPLOYMENT.md).

El escudo queda al **70% de su tamaño anterior**: una reducción uniforme del
30% alrededor del asa, sin mover el punto de agarre. El juego carga copias
optimizadas de espada y escudo: **7.61 MB y 122,930 triángulos** entre ambas.
Los tres archivos originales se conservan intactos. El
[detalle de la integración](docs/RUEN_GAME_EQUIPMENT.md) distingue los masters,
las copias jugables y el alcance de las animaciones.

Ruen respira al detenerse y mantiene el equipo al caminar y correr, con
transiciones de 0.2 s. Salto, esquiva, ataques, defensa y las demás acciones
conservan el rig provisional hasta adaptar sus animaciones. Si una pieza del
equipo no carga, queda disponible el Ruen real sin equipo, con Idle y locomoción.
`/?ruen=meshy` sigue siendo un alias y `/?ruen=provisional` carga el rig anterior.

## Visor de Ruen / Meshy

[Visor original](https://dabot11.github.io/Veylun/?inspect=ruen) ·
[Idle neutro](https://dabot11.github.io/Veylun/?inspect=ruen&motion=idle-v1) ·
[Idle con equipo](https://dabot11.github.io/Veylun/?inspect=ruen&motion=idle-v1&equipment=azure).
Los enlaces públicos muestran la última publicación registrada arriba.

Con Vite iniciado, `/?inspect=ruen` carga el master automáticamente y queda
pausado. **Recargar modelo original** permite volver a cargarlo; también puedes
abrir un GLB local. Hay selector de clip, reproducir/pausar, velocidad, tres
vistas e inventario JSON, sin simulación ni acceso al guardado.

El visor conserva los GLB originales completos y los 20 clips del master;
la variante `equipment=azure` permite comparar el Idle con y sin equipo.
En esta revisión también usa el escudo reducido un 30%. La ruta neutra no
descarga las armas. Consulta el [informe del master](docs/RUEN_MESHY_INSPECTION.md),
la [ficha del equipo](docs/RUEN_EQUIPMENT_PREVIEW.md) y la
[guía de animaciones](docs/RUEN_ANIMATION_WORKFLOW.md).

## Recorrido

1. Explora el Claro del despertar y sigue la luz turquesa hacia el sendero.
2. Derrota a los dos Brotes corruptos. Se libera el paso y se activa checkpoint 1.
3. Derrota al Espíritu, activa el interruptor y entra por la reja al cofre.
4. Recoge la llave y abre la puerta del santuario con interacción. Checkpoint 2.
5. Vence al Guardián y **activa el altar**. Derrotar al jefe por sí solo no gana.

El brillo turquesa que acompaña a Ruen señala el objetivo siguiente. Los aros
ámbar anuncian ataques. El Guardián alterna golpe frontal (bloqueable) y golpe
al suelo (esquivar, alejarse o saltar). Aprovecha su recuperación para atacar.
En las ruinas, la luz rodea el recinto para conducir a Ruen por la reja abierta
y señalar la salida cuando recoge la llave. El HUD explica el siguiente paso.

En el primer encuentro, una flecha indica la dirección de la embestida.
Los Brotes alternan sus ataques y se detienen al chocar contra el escudo.
El panel del enemigo muestra vida, objetivo fijado y oportunidad de respuesta;
los impactos tienen destello, reacción, partículas y sonido propio.

El Espíritu anuncia su magia con una esfera que crece y un sonido ascendente.
La dirección se fija antes de disparar: bloquea de frente o esquiva a un lado.
Después queda agotado y puedes acercarte para golpear. Al vencerlo, sigue el
haz de luz hasta el interruptor y actívalo con E / Y para abrir la reja.

El Guardián alterna un sector frontal bloqueable y un golpe al suelo circular
que exige salir del área o esquivar a tiempo. Ataca cuando el panel indique
«Expuesto». Al derrotarlo, sigue la luz del altar e interactúa para restaurar el
santuario; la victoria llega después de la ceremonia.

## Controles

| Acción | Teclado / ratón | Xbox estándar |
|---|---|---|
| Moverse | WASD | Stick izquierdo |
| Cámara | Ratón / arrastrar | Stick derecho |
| Saltar | Espacio | A |
| Rodar | Shift | B |
| Espada | Clic izquierdo / J | X |
| Interactuar | E | Y |
| Escudo | Clic derecho / K | LT |
| Fijar / soltar objetivo | Q | RT |
| Cambiar objetivo | Tab | LB / RB |
| Pausa | Escape | Menu |

Encadena hasta tres golpes pulsando de nuevo durante el ataque. El tercero
hace más daño. Acércate al enemigo y usa Q / RT para mantenerlo fijado;
también puedes dirigir el golpe con el movimiento. Escudo de frente,
invulnerabilidad breve al rodar y después de
recibir daño. No hay parry, ataques cargados ni doble salto.

Para Xbox en macOS: empareja el mando en Ajustes del Sistema → Bluetooth,
abre Chrome y pulsa un botón. Stick vertical o cruceta navega los menús;
A selecciona, B vuelve. En Controles → Diagnóstico del mando se muestran
mapping, ejes y botones. Los mandos de mapping no estándar se diagnostican
pero requieren teclado/ratón; no se adivinan asignaciones.

## Guardado

`localStorage`, clave `veylun.save.v1`, esquema validado. Se guarda después
de eventos importantes y periódicamente durante la partida. Continuar aparece
si hay datos válidos. Si el almacenamiento falla, se avisa y se sigue en memoria:
puedes volver al menú y continuar en la misma sesión, pero cerrar o recargar
puede perder ese avance. También se avisa si el navegador bloquea por completo
el acceso a `localStorage`.
La pausa permite volver al checkpoint y reiniciar con confirmación.
Durante la restauración puedes pausar y reanudar; el retorno al checkpoint
no está disponible para evitar interrumpir el cierre de la aventura.

Al morir se conservan llave, cofre, interruptor, reja, puerta y enemigos
ordinarios derrotados. Ruen recupera diez unidades de salud; la pelea del
Guardián se reinicia. Los checkpoints recuperan salud y los enemigos ordinarios
derrotados recuperan una unidad como ayuda de balance.

## Arte y estado real

Se revisaron **24 referencias PNG de personajes**, seis por cada uno, más la
imagen del santuario visible en el chat. Los originales están separados en
`design/references/` y no se descargan con el juego.

Ruen usa el GLB real de Meshy mediante `RuenLocomotionView`. Esta revisión
integra Idle y locomoción con equipo optimizado; el resto de acciones conserva
el rig provisional. Los tres enemigos y el rig alternativo de Ruen siguen
siendo **3D procedurales provisionales**; simplifican las ilustraciones.
El arte final y el rendimiento en el equipo del usuario siguen pendientes.
`VisualOverrides` conserva la vía genérica de carga desde `assetCatalog.ts`
para futuras sustituciones.

La primera revisión de Ruen añade cabello de mechones afinados, capa con
emblema dorsal, equipo más definido y articulación de codos y rodillas. El claro
incorpora anillos de piedra, helechos, flores, musgo y sombras del dosel cercano.
Detalles y comprobaciones en `docs/ART_PASS.md`.

## Pruebas

La revisión del Idle equipado dentro del juego aprobó typecheck, build,
**152 pruebas unitarias en 16 archivos y 33 de navegador**. La suite completa
de navegador terminó en 28.7 minutos sin omisiones ni reintentos. El estado,
las capturas y la evidencia actual se registran en
[RUEN_GAME_EQUIPMENT](docs/RUEN_GAME_EQUIPMENT.md) y [VALIDATION](docs/VALIDATION.md).

Pruebas de lógica: `npm test`. Incluyen un recorrido completo con comandos de
movimiento, ataques e interacción, sin conceder daño ni objetos en esa prueba.
Las pruebas aisladas sí crean estados concretos para verificar cada regla.

Pruebas de navegador: cuatro sobre el build, una de controles/altar y cuatro de
combate con teclado, ratón y Xbox simulado, incluido un bloqueo y contraataque
con la IA del Brote activa. Otras dos recorren el encuentro del Espíritu y
activan el interruptor usando teclado y Xbox simulado. Dos más completan el
combate del Guardián hasta restaurar el altar, y otra comprueba la carga de una
victoria y el reinicio visual de nueva aventura. Las pruebas de desarrollo usan
encuentros preparados para comprobar daño real desde la entrada del navegador.

La prueba de recorrido de `journey.spec.ts` empieza desde Nueva partida y usa
solo entradas normales para completar la aventura, con una muerte deliberada
y recargas entre checkpoints. Dos regresiones adicionales revisan el progreso
de sesión sin almacenamiento y la pausa durante la restauración.

La revisión Meshy anterior (`6a80022`) pasó **119 pruebas unitarias en 12 archivos
y 24 pruebas de navegador**, estas últimas en una ejecución sin reintentos de 11.8 minutos.
Incluyen tres casos del visor con fixture sintético y cuatro del master real:
carga/locomoción, transiciones y fallbacks, colisión y error de carga. Typecheck
y build correctos; Vite avisa de un chunk del cargador glTF superior a 500 kB.

La revisión de carga automática y reposo estático pasó **123 pruebas unitarias
en 12 archivos y 26 pruebas de navegador**, en una ejecución de 18.6 minutos
sin reintentos; typecheck y build correctos. Incluye 17 casos del MVP, tres del
visor con fixture sintético y seis de integración: cuatro cargan el master,
uno comprueba descarga abortada y otro opt-out sin descarga. Ver el
[log histórico](docs/evidence/ruen-meshy/default-idle-browser.log).

Para ejecutar las pruebas:

```sh
npm run build
npx playwright install chromium
npm run test:e2e
```

Si Chromium ya está instalado:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Se usa un Xbox **simulado** para probar la Gamepad API; no se probó hardware
físico. La lista de verificaciones y resultados está en `docs/VALIDATION.md`.

## Próxima iteración

Refinar modelos/animación, distribución del bosque y calidad de texturas;
medir rendimiento en Chrome/macOS real; probar Xbox físico; ajustar dificultad
y duración con jugadores. El objetivo de 10–15 minutos y 60 FPS aún requiere
validación en hardware real. El MVP es más compacto para un jugador que ya
conoce el recorrido. No hay música de fondo: los efectos son síntesis original.

Documentación: `GAME_DESIGN.md`, `ART_DIRECTION.md`, `ASSET_MANIFEST.md`,
`ARCHITECTURE.md` y `docs/ACCEPTANCE.md`.
El pulido del primer encuentro se describe en `docs/COMBAT_POLISH.md`.
El combate a distancia y la guía al interruptor están en `docs/SPIRIT_ENCOUNTER.md`.
El jefe y la restauración se describen en `docs/GUARDIAN_ENCOUNTER.md`.
La orientación y continuidad están documentadas en `docs/JOURNEY_POLISH.md`.
