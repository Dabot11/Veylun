# Reposo, guardia y agarre de Ruen

Estado: **validado y publicado desde `878956ab`**. Aprobaron 243 unitarias,
cuatro casos seleccionados de navegador, typecheck y build. El
[PR #8](https://github.com/Dabot11/Veylun/pull/8) integra la revisión y
[Actions](https://github.com/Dabot11/Veylun/actions/runs/40113250432) confirma la publicación.
[Registro y reversión](DEPLOYMENT.md).

La revisión parte del comentario de que las poses se sienten rígidas y el
personaje no sostiene las armas con naturalidad. El ajuste se concentra en
el agarre, el reposo de exploración y la guardia de combate; el transporte
del equipo se adapta también al movimiento.

## Cambios de esta etapa

| Parte | Ajuste |
| --- | --- |
| Agarre | Alinear el mango de espada y escudo con el eje que rodean los dedos y situar el contacto dentro del puño. |
| Reposo | Espada baja, escudo descansando, codos flexionados, apoyo asimétrico y respiración discreta. |
| Guardia | Rodillas flexionadas, escudo por debajo de la mirada y espada preparada; la orientación se reparte entre antebrazo y muñeca. |
| Bloqueo recibido | Reacción breve que comienza y termina en la nueva guardia, conservando sus 0.22 s. |
| Caminar y correr | Espada levantada y escudo relajado en las ocho variantes frontales, laterales y hacia atrás; se conservan torso, piernas y tiempos. |

Se mantienen los cinco GLB, el rig de 80 joints, los 20 clips originales y
las escalas del equipo: espada 0.55 y escudo 0.294, el 70% del tamaño inicial.
La etapa ajusta clips propios; no añade acciones, daño, movimiento de raíz ni
reglas de combate. El inventario permanece en 22 clips propios, 42 grupos en
juego y 43 en el visor con el Idle neutro.

Las poses se revisaron sobre las mallas reales, de frente, de lado y desde
atrás, con acercamientos a ambas manos. Los pies conservan el apoyo mientras
pelvis y torso respiran. En guardia, el ángulo entre antebrazo y mano pasó
de 47.4°/32.3° a 21.4°/19.6° (izquierda/derecha). El codo de la espada en
reposo pasó de 10.3° a 69.9° de flexión. El mango ahora cruza el puño cerrado.
Estas medidas acompañan la revisión visual del agarre y la silueta.

## Visor

[Jugar](https://dabot11.github.io/Veylun/?v=878956ab) ·
[Ver reposo y guardia](https://dabot11.github.io/Veylun/?inspect=ruen&motion=posture-v1&v=878956ab).
La ruta local `?inspect=ruen&motion=posture-v1` abre **Reposo · exploración**
en pausa. El selector permite comparar ese reposo con **Guardia** y
**Bloqueo recibido**, además de las otras animaciones. El visor conserva el
guardado y no ejecuta combate.

## Evidencia

La referencia anterior, los ajustes rechazados y las poses finales se
conservan por separado. La calibración final de los 22 clips equipados cubrió
1,182 muestras, dentro de 0.01 unidades de tolerancia de suelo. Los cinco GLB
conservan sus hashes. Aprobaron 243 unitarias en 21 archivos, typecheck y
build. El adaptador aprobó 720 muestras de cuatro escenarios tras corregir
el apoyo de la suela al frenar; la raíz y el controlador no se desplazan por
ese ajuste. Aprobaron cuatro casos seleccionados de los 53 disponibles
(3 de desarrollo y 1 de producción). Tres aprobaron inicialmente; el visor
de desarrollo aprobó al repetirlo tras corregir la pausa explícita del test
al seleccionar un clip. La aplicación y el build no cambiaron.
[Evidencia de esta revisión](evidence/ruen-natural-stances/README.md).
