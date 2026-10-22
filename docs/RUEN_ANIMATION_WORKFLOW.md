# Cómo crearemos las animaciones de Ruen

Crearemos clips sobre el esqueleto de **80 joints que ya trae el GLB**. Para
cada animación definimos poses en momentos concretos mediante keyframes; el
motor interpola entre ellas. Así conservamos el modelo, su skin y materiales.
El archivo master permanece intacto y los clips nuevos se guardan por separado.

## Primer prototipo: Idle propio v1

Estado: **prototipo exclusivo del visor, validado técnicamente y publicado**.
El juego publicado sigue usando la pose base estática al detenerse. Este trabajo
no añade todavía una animación Idle al gameplay ni modifica los 20 clips del master.

La primera versión se define con claves creadas aquí mediante **Babylon.js**:

- Duración de 4 segundos, a 30 fotogramas por segundo.
- Dos canales de rotación: `mixamorig:Spine1` y `mixamorig:Spine2`.
- Movimiento sutil del torso, con menos de 2° de rotación total combinada.
- Inicio y final coincidentes, con variación suave para repetir el ciclo.
- Pies, pelvis y raíz sin claves nuevas ni desplazamiento añadido.

La intención es sugerir una respiración suave conservando el apoyo de los pies.
La continuidad del loop y las poses de frente, lado y espalda se comprobaron.
La aprobación artística y las transiciones dentro del juego siguen pendientes.
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
La variante pasó las pruebas locales; su publicación está pendiente. La espada se monta en
`mixamorig:RightHand` y el escudo en `mixamorig:LeftHand`; el ajuste utiliza
el mango y el asa que ya existen en los GLB.

El clip conserva el ciclo de respiración de cuatro segundos y añade claves
constantes para la postura de brazos, manos y dedos. Esas claves pertenecen
al clip propio, de modo que al salir de él se restaura la pose de los joints.
El selector **Espada y escudo (Idle)** alterna con el Idle neutro conservando
el momento del ciclo, la velocidad y el estado de reproducción. Elegir un
clip original oculta el equipo y restaura los canales de la pose equipada.

Los 20 clips originales permanecen separados de estas dos variantes propias.
La ruta sin `equipment=azure` mantiene el prototipo neutro anterior. El equipo
y la pose equipada sólo se cargan en esta prueba del visor: todavía no se
conectan a locomoción, defensa ni daño. [Archivos y alcance de la prueba](RUEN_EQUIPMENT_PREVIEW.md).

Tras el ajuste final aprobaron typecheck, build, 142 pruebas unitarias en
15 archivos y 10 casos únicos de navegador, repartidos en dos ejecuciones
sin reintentos. [Evidencia y registros](evidence/ruen-equipment/README.md).

## Orden de trabajo

1. **Idle:** revisar respiración, estabilidad y loop; después probar la transición
   con Walking/Running sin un salto de pose.
2. **Salto:** separar impulso, aire y aterrizaje. La física determina cuándo se
   despega y toca el suelo; la pose acompaña esos estados.
3. **Esquiva:** adaptar la postura a la duración y desplazamiento de la esquiva
   actual, manteniendo sus colisiones e invulnerabilidad.
4. **Guardia y bloqueo:** crear una postura sostenida y una reacción de impacto
   que respeten la defensa y el arco frontal existentes.
5. **Espada y escudo:** revisar el montaje inicial en el visor y ajustar
   agarre/orientación; comprobar manos, cuerpo y capa antes de extenderlo
   a locomoción y acciones del juego.
6. **Golpes:** crear poses y transiciones para los ataques del MVP, haciendo
   coincidir el movimiento de la espada con sus ventanas de impacto existentes.

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
de integración del nuevo Idle en gameplay.
