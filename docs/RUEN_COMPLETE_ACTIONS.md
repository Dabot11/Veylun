# Acciones restantes de Ruen

Estado: **validado y publicado desde `f0402306`**. Todos los
estados existentes tienen representación con el rig real y su equipo cuando
la carga es correcta. Aprobaron 234 unitarias, 13 casos seleccionados de
navegador, typecheck, build y calibración de contacto. El
[PR #7](https://github.com/Dabot11/Veylun/pull/7) integra la etapa y
[Actions](https://github.com/Dabot11/Veylun/actions/runs/39923103610) confirma
la publicación. [Registro y reversión](DEPLOYMENT.md).

## Estados y tiempos

| Acción existente | Clip propio | Adaptación |
| --- | --- | --- |
| Daño | `Ruen_Hurt_Equipped` | Reacción de 0.3 s, seguida por el estado que decida la simulación. |
| Muerte | `Ruen_Death_Equipped` | Caída de 1.25 s y pose final sostenida hasta la reaparición, después de 1.6 s. |
| Interacción | `Ruen_Interact_Equipped` | Clip de 0.5 s. |
| Victoria | `Ruen_Victory_Equipped` | Clip de 3 s y pose final sostenida. |
| Caminar y correr hacia izquierda, derecha y atrás | Seis variantes direccionales | Conservan la orientación y el movimiento del controlador. |
| Ataques, guardia y reacción al bloqueo en el aire | Composición de clips existentes | Se combinan con salto/caída; no añade clips al inventario. |
| Guardia/bloqueo al aterrizar y bloqueo durante interacción | Composición de clips existentes | Conserva el aterrizaje o la interacción en el tren inferior mientras aplica la defensa. |

Las variantes direccionales son `Ruen_Walk_Left_Equipped`,
`Ruen_Walk_Right_Equipped`, `Ruen_Walk_Back_Equipped`, `Ruen_Run_Left_Equipped`,
`Ruen_Run_Right_Equipped` y `Ruen_Run_Back_Equipped`.

La animación sigue los estados y relojes del juego. El daño, las ventanas de
ataque, la defensa, el movimiento, la gravedad y la reaparición conservan sus
reglas. No se añaden estados jugables para completar esta etapa.

## Modelo y visor

Se conservan el master de Ruen, los dos originales del equipo y sus dos copias
optimizadas. Los 20 clips originales permanecen intactos. El escudo mantiene
el 70% del tamaño inicial, con montaje 0.294; la espada mantiene 0.55.

Los cuatro clips de acciones y las seis variantes direccionales amplían el
conjunto a **22 clips propios**, creados en memoria. Con los originales son
**42 grupos en gameplay**. El visor añade el Idle neutro y tiene **43**.

Abre [el juego](https://dabot11.github.io/Veylun/?v=f0402306) o el
[visor de acciones](https://dabot11.github.io/Veylun/?inspect=ruen&motion=actions-v1&v=f0402306).
La ruta local es `?inspect=ruen&motion=actions-v1`; comienza en
**Daño**, pausada. Permite revisar las acciones junto con los clips propios
anteriores. La reproducción del visor no aplica daño, interacción, victoria
ni reaparición: esos eventos pertenecen a la simulación.

## Calidad y errores

Las poses y curvas usan keyframes sobre el esqueleto original. La revisión
visual comprueba apoyos, manos, capa y silueta desde el frente, el lado y la
espalda.

El rig provisional se conserva como respaldo ante errores de carga o de
creación de animaciones. La carga parcial del equipo se oculta y permite
que la partida continúe; el caso de escudo ausente aprobó en navegador.
`?ruen=provisional` permite comparar con el modelo anterior sin cambiar archivos
ni guardado; quitar el parámetro restaura la carga del modelo real.

## Comprobación actual

La calibración aislada recorrió 523 poses de los diez clips nuevos a 60 Hz,
sin errores de página. La calibración del adaptador recorrió 915 muestras de
diez escenarios: ninguna recurrió al rig provisional ni alteró la raíz del
jugador. El peor contacto con el suelo quedó en −0.0007373 unidades, dentro
de la tolerancia de 0.01. Estas comprobaciones son calibración manual y no
sustituyen las pruebas desde controles.

`diagnostics.combat.lowerBody` registra estado, tiempo y fotograma de
`jump`, `fall`, `land` o `interact` cuando el combate se compone con ellos.

Aprobaron **13 casos seleccionados de 51**: siete nuevos y seis regresiones,
11 de desarrollo y dos de producción. Incluyen el recorrido completo
`journey`, acciones desde controles, pausa, guardado, las seis combinaciones
direccionales y combate aéreo. Doce aprobaron inicialmente; el caso de
escudo ausente aprobó tras corregir la espera de reproducción del test.
La aplicación y el build se mantuvieron intactos.
[Calibración, correcciones y logs](evidence/ruen-complete-actions/README.md).
