# Cómo crearemos las animaciones de Ruen

Crearemos clips sobre el esqueleto de **80 joints que ya trae el GLB**. Para
cada animación definimos poses en momentos concretos mediante keyframes; el
motor interpola entre ellas. Así conservamos el modelo, su skin y materiales.
El archivo master permanece intacto y los clips nuevos se guardan por separado.

## Combate equipado publicado

La etapa actual crea **guardia, reacción al bloqueo y los tres golpes del combo**
sobre el esqueleto real. Cada clip se define mediante keyframes de huesos; no
requiere reemplazar el modelo ni descargar animaciones externas. Los tiempos
se toman de `src/player/combat.ts`, manteniendo daño, alcance y movimiento de
la simulación. La factoría crea cinco grupos de 60 fps: guardia de cuatro
segundos, bloqueo de 0.22 s y ataques de 0.48/0.50/0.63 s. Typecheck, build y
173 pruebas unitarias aprobaron tras corregir la repetición del visor y una
tolerancia numérica detectadas en la primera tanda de navegador. Los siete
casos nuevos y las 33 regresiones aprobaron; una regresión se repitió tras
corregir sólo su texto esperado. Son 40 casos únicos aprobados. Publicado
desde `f828d841`, con confirmación de Actions: [alcance de combate](RUEN_GAME_COMBAT.md).

## Etapa anterior: integración de Idle y locomoción

La versión anterior `50210a9c` incorporó **Idle, caminar y correr con espada y escudo** a la ruta
normal del juego. El escudo se reduce uniformemente un 30%; las armas usan
copias ligeras y los originales se conservan. Typecheck, build, 152 pruebas
unitarias y 33 de navegador aprobaron. Publicada desde `50210a9c`, con
confirmación de Actions: [alcance actual](RUEN_GAME_EQUIPMENT.md).

Los grupos `Ruen_Idle_Equipped`, `Ruen_Walk_Equipped` y `Ruen_Run_Equipped`
comparten el conjunto completo de canales para mezclar poses durante 0.2 s.
Idle conserva el ciclo de respiración; las variantes de locomoción conservan
el cuerpo, pelvis y piernas de los clips importados y adaptan los agarres de
brazos, manos y dedos. La simulación sigue controlando desplazamiento y daño.
Si no carga todo el equipo, se utiliza una variante sin armas con Idle neutro.

## Primer prototipo: Idle propio v1

Estado histórico: **prototipo del visor validado y publicado en `43fa18c`**.
Esa revisión no añadía Idle al gameplay. La versión `50210a9c` ya lo integra,
sin modificar los 20 clips del master.

La primera versión se define con claves creadas aquí mediante **Babylon.js**:

- Duración de 4 segundos, a 30 fotogramas por segundo.
- Dos canales de rotación: `mixamorig:Spine1` y `mixamorig:Spine2`.
- Movimiento sutil del torso, con menos de 2° de rotación total combinada.
- Inicio y final coincidentes, con variación suave para repetir el ciclo.
- Pies, pelvis y raíz sin claves nuevas ni desplazamiento añadido.

La intención es sugerir una respiración suave conservando el apoyo de los pies.
La continuidad del loop y las poses de frente, lado y espalda se comprobaron.
Las transiciones dentro del juego se revisan en la etapa actual.
No se presenta como una animación exportada desde Blender: las claves de esta
versión se construyen por código sobre el rig existente.

La ruta del prototipo en esta revisión es `?inspect=ruen&motion=idle-v1`.
Carga automáticamente el modelo y el Idle propio **en pausa**; se reproduce
desde el visor. Su identidad y metadatos se mantienen separados del inventario
de los 20 clips originales. [Abrir el prototipo](https://dabot11.github.io/Veylun/?inspect=ruen&motion=idle-v1) y pulsar **Reproducir**.
Publicado desde `43fa18c`; [Actions](https://github.com/Dabot11/Veylun/actions/runs/39853291990) confirmó **Success**.

## Idle con espada y escudo

La ruta `?inspect=ruen&motion=idle-v1&equipment=azure` prepara una segunda
variante, `Ruen_Idle_Armed_v1`, para visualizar los dos modelos entregados.
La variante pasó las pruebas locales y está [publicada](https://dabot11.github.io/Veylun/?inspect=ruen&motion=idle-v1&equipment=azure).
La espada se monta en
`mixamorig:RightHand` y el escudo en `mixamorig:LeftHand`; el ajuste utiliza
el mango y el asa que ya existen en los GLB.

El clip conserva el ciclo de respiración de cuatro segundos y añade claves
constantes para la postura de brazos, manos y dedos. Esas claves pertenecen
al clip propio, de modo que al salir de él se restaura la pose de los joints.
El selector **Espada y escudo (Idle)** alterna con el Idle neutro conservando
el momento del ciclo, la velocidad y el estado de reproducción. Elegir un
clip original oculta el equipo y restaura los canales de la pose equipada.

Los 20 clips originales permanecen separados de estas dos variantes propias.
La ruta sin `equipment=azure` mantiene el prototipo neutro anterior. El visor
conserva los masters completos; la integración jugable usa copias optimizadas
con la misma referencia de agarre. Defensa y daño siguen fuera de esta etapa.
[Archivos y alcance del visor](RUEN_EQUIPMENT_PREVIEW.md).

Tras el ajuste final aprobaron typecheck, build, 142 pruebas unitarias en
15 archivos y 10 casos únicos de navegador, repartidos en dos ejecuciones
sin reintentos. [Evidencia y registros](evidence/ruen-equipment/README.md).

## Orden de trabajo

1. **Idle y locomoción equipada, publicado:** escudo reducido, copias ligeras,
   agarres y transiciones al detenerse, caminar y correr.
2. **Guardia, bloqueo y combo completo, etapa actual:** crear la postura
   sostenida, la reacción de impacto y los tres ataques con las ventanas
   existentes. Validar poses, continuidad y ejecución desde los controles.
3. **Salto y esquiva:** separar impulso, aire y aterrizaje, y adaptar la rodada
   a su duración y desplazamiento actuales, conservando física e invulnerabilidad.
4. **Daño, muerte y demás acciones:** reemplazar sus variantes provisionales
   tras comprobar interrupciones y transiciones.

La duración de cada acción se ajusta a `Simulation` y a los tiempos de combate;
no alargamos ni cambiamos las reglas para acomodar un clip. La simulación sigue
decidiendo daño, movimiento y colisiones. El root motion se revisa y controla
explícitamente: una traslación del clip no puede mover al personaje una segunda
vez además del controlador. Idle v1 no incorpora root motion.

## Herramientas y clips externos

**Blender 4.3.2 está disponible** para elaborar poses más complejas, editar curvas
y hacer retarget en fases posteriores. Retarget significa adaptar el movimiento
de otro esqueleto al de Ruen: correspondencias entre huesos, ejes locales, pose
de referencia y proporciones. Después se corrigen manos, pies, articulaciones
y contacto con el suelo.

Que dos esqueletos usen nombres con el prefijo `mixamorig` no garantiza que sus
clips sean intercambiables. Un clip externo requiere esa revisión y, cuando
corresponda, retarget y correcciones; no se conecta directamente por su nombre.

## Antes de activarlas en el juego

Cada clip pasa primero por el visor: frontal, lateral y espalda, reproducción
lenta, inicio/final y loop cuando corresponda. Revisamos deformaciones, pies,
manos, capa y consola. Después se prueba dentro del juego de forma explícita,
incluyendo transiciones, pausa, colisiones y estados de interrupción. Sólo tras
esa revisión se activa por defecto.

Para Idle v1 pasaron typecheck, build, **130 pruebas unitarias en 13 archivos y
7 casos únicos de navegador**. Tres casos de navegador se repitieron tras
cerrarse el servidor local; los siete terminaron aprobados. Las capturas y
registros están en la [evidencia del prototipo](evidence/ruen-idle-v1/README.md).
La publicación se confirmó mediante Actions; el dominio público no se pudo
abrir desde la red de este entorno. Los resultados anteriores del juego se conservan
en el [informe de Meshy](RUEN_MESHY_INSPECTION.md); no se presentan como pruebas
de integración del Idle equipado en gameplay. Los resultados de esa etapa se
registraron en la [evidencia jugable](evidence/ruen-game-equipment/README.md).
La etapa de combate tiene [su propio registro](evidence/ruen-game-combat/README.md),
con las comprobaciones iniciales y los hallazgos de la primera tanda de
navegador y el cierre de 40 casos únicos aprobados, incluida una repetición
aislada por una expectativa de texto.
