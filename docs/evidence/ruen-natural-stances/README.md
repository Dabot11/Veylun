# Evidencia de reposo y guardia de Ruen

Estado: **validado; publicación pendiente**.
La fuente pública vigente es `f0402306`.
[Alcance](../../RUEN_NATURAL_STANCES.md).

## Poses y agarre

La [calibración](calibration-summary.json) conserva la referencia anterior,
la primera prueba rechazada y las poses finales. Cada conjunto de Idle/Guardia
incluye 242 muestras de las mallas reales a 30 Hz y 20 capturas desde frente,
lado y espalda, con acercamientos a ambas manos. No hubo errores de página
ni consola; los 20 clips originales y la raíz del modelo permanecieron iguales.

La corrección alinea ambos mangos con los dedos que los rodean y coloca el
contacto dentro del puño. La primera prueba todavía forzaba las muñecas; se
ajustaron posiciones de agarre y codos, distribuyendo el giro axial en los
antebrazos. Las poses finales se revisaron visualmente desde las tres vistas.

| Medida geométrica en reposo del clip | Antes | Después |
| --- | --- | --- |
| Muñeca izquierda, guardia | 47.4° | 21.4° |
| Muñeca derecha, guardia | 32.3° | 19.6° |
| Flexión de codo derecho, Idle | 10.3° | 69.9° |

El ángulo de muñeca compara la prolongación del antebrazo con el eje longitudinal
de la mano. El Idle final tiene 22.0°/18.0° de ángulo de muñeca y 88.3°/69.9°
de flexión de codo; la guardia, 21.4°/19.6° y 102.9°/103.5°. Los pares indican
izquierda/derecha. En sus 242 muestras, el mínimo del cuerpo fue −0.0008525,
el del equipo +0.1346166 y el error máximo de anclaje 1.32e−7 unidades.

Capturas seleccionadas ([inventario](screenshots.json)):

- Idle [antes](before-idle-front.png) y [después](idle-front.png), con [lado](idle-side.png) y [espalda](idle-back.png).
- Guardia de lado [antes](before-guard-side.png) y [después](guard-side.png), con [frente](guard-front.png).
- Agarre de espada [antes](before-idle-right-grip-side.png) y [después](idle-right-grip-side.png); [agarre del escudo](guard-left-grip-side.png).

Los conjuntos completos permanecen en
`/workspace/veylun-validation/ruen-natural-poses`. Estas capturas son del visor,
no del juego accionado mediante controles.

## Contacto de los 22 clips equipados

Cambiar el montaje afecta a todos los clips equipados. El primer barrido
midió la espada a −0.1400718 unidades durante carrera lateral con transporte
bajo. Se corrigió usando el brazo derecho de guardia al moverse y el izquierdo
del reposo relajado, en ocho variantes de caminar/correr. Se conservan sus
canales de torso y piernas.

El barrido final recorrió **1,182 muestras de 22 clips**, con sus extremos y
pasos de un fotograma. El mínimo del cuerpo fue **−0.0010469** y el del equipo
**+0.0892450**, dentro de la tolerancia de suelo de 0.01. Ambos elementos
mantuvieron sus anclajes y permanecieron habilitados. Hay 43 grupos en el
visor y 20 originales; no hubo errores de página.
[Resumen por clip](calibration-summary.json).

## Transiciones del adaptador

La [calibración de runtime](runtime-contact-summary.json) usa pasos manuales
de simulación a 60 Hz y las mallas reales. La primera frenada dejó la suela
hasta −0.016255 unidades bajo el suelo. El ajuste de referencias de joints
redujo ese mínimo a −0.010900; 12 sondas de superficie aún omitían el punto
más bajo. La solución final usa 20 puntos reales de suela ligados a Foot,
Toe y Leg, aplicados después de mezclar las animaciones. El ajuste sólo
corrige la altura de la pelvis visible al pasar del movimiento al Idle.

La repetición aislada de frenada aprobó 180 muestras: cuerpo a −0.0006522 y
equipo a +0.1148201 como mínimos. Los otros tres escenarios —cambio de
guardia, guardia móvil y mezcla direccional— ya habían aprobado 180 muestras
cada uno y no cambiaron con esta corrección. El cierre reúne **720 muestras
de cuatro escenarios**, con cero desplazamiento adicional de raíz y cero
usos del modelo provisional. El mínimo del conjunto fue −0.0044866, dentro
de la tolerancia de 0.01.

Logs: [inicial](runtime-contact.log), [referencias de apoyo](runtime-contact-final.log),
[12 sondas](runtime-surface-final.log) y [20 sondas, frenada final](runtime-stop-final.log).
Estos registros de calibración se distinguen de los casos de navegador
accionados mediante controles.

## Pruebas

Aprobaron **243 unitarias en 21 archivos** en 9.99 s, typecheck y build; Vite
terminó en 1.40 s con el aviso conocido de chunks grandes.
[Unitarias](unit.log) · [Build](build.log).
Los [SHA-256 de los cinco GLB](asset-hashes.json) coinciden con los inventarios
de la fuente publicada `f0402306`.

## Navegador: cuatro casos seleccionados aprobados

Aprobaron **4 de los 53 casos disponibles**, con 3 de desarrollo y 1 de
producción. La selección comprueba el visor con malla real y ciclos de
Idle/Guardia/Bloqueo; producción sin hooks ni escritura de guardado; Idle,
caminar/correr y salto/voltereta desde controles; y bloqueo real de Brote
con guardia móvil y objetivo fijado. No se repitió el recorrido `journey`.
[Resumen](browser-summary.json) · [Mediciones](browser-checks.json).

| Corrida con pruebas | Resultado | Duración |
| --- | --- | --- |
| Cuatro seleccionados | 3 aprobados, 1 fallido | 222,460.162 ms |
| Repetición aislada del visor de desarrollo | 1 aprobado | 104,796.937 ms |

El fallo inicial pertenecía al test: seleccionar un clip inicia su reproducción,
pero el muestreo exigía pausa. Se añadió la pausa explícita al seleccionar
Idle, Guardia y Bloqueo; sólo se repitió ese caso. La aplicación y el build
permanecieron intactos. Una invocación intermedia no seleccionó casos por su
filtro; sus registros externos se conservan y no cuentan como prueba ejecutada.
[Primera corrida](browser.log) · [Repetición](preview-retest.log).

El muestreo del visor comprobó 15 poses con 70,995 vértices del cuerpo, ciclos
cerrados, raíz fija y apoyo de pies: deriva máxima de 5.39e−8 unidades. El
bloqueo desde controles registró un impacto de Brote con salud 10 → 10,
equipo visible y guardia móvil. No hubo errores de aplicación en los casos
aprobados. Capturas del caso del visor:

- Reposo: [frente](browser-idle-front.png), [lado](browser-idle-side.png), [espalda](browser-idle-back.png).
- Guardia: [frente](browser-guard-front.png), [lado](browser-guard-side.png), [espalda](browser-guard-back.png).

El [manifiesto final de 106 archivos](source-manifest.sha256) registra el ajuste
del test. Se conserva también el [manifiesto anterior](source-manifest-before-preview-pause.sha256).
No se atribuyen a esta revisión las pruebas de etapas anteriores. La publicación
aún no se ha iniciado.
