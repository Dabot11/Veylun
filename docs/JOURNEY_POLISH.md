# Recorrido, orientación y continuidad

Esta revisión conecta los encuentros ya pulidos en una aventura que se puede
retomar desde sus recuerdos. Conserva los dos checkpoints, las estadísticas de
los enemigos, los tiempos de combate y el esquema de guardado v1.

## Orientación

- El claro indica movimiento y salto con teclado o Xbox. El objetivo siguiente
  explica la relación entre el Espíritu, el interruptor, la reja y el cofre.
- La luz guía usa puntos alrededor del recinto del cofre y comprueba los
  segmentos contra las colisiones reales con margen para Ruen. Entrar por la
  reja y salir con la llave dejan de señalar a través de la pared. La luz sigue
  visible al acercarse a una esquina, hasta llegar al alcance del objetivo.
- El cofre mira hacia la entrada de la reja: su tapa se abre alejándose de Ruen.
- Las instrucciones de viaje ceden espacio a las de combate, interruptor y altar.
  El título de zona y los avisos temporales no se superponen.
- Continuar y reaparecer muestran la zona del checkpoint, sin anunciar el claro
  inicial ni conservar avisos de una aventura anterior.

## Continuidad

- El almacenamiento conserva una copia de la sesión. Si el navegador rechaza
  una escritura, volver al menú y continuar usa ese progreso, aunque exista un
  guardado anterior en disco. Reiniciar sigue pidiendo confirmación.
- Si incluso acceder a `localStorage` falla, se muestra la misma advertencia:
  el avance de la sesión puede perderse al cerrar o recargar. No se promete
  persistencia cuando el navegador no permite escribir.
- Abrir los controles desde el título y cerrar la página no crea una partida
  que nunca se inició.
- Volver al checkpoint no puede sacar la simulación de la restauración o de la
  victoria. Durante la ceremonia se puede pausar y reanudar; la opción de
  checkpoint deja de mostrarse.
- La pausa explica que el retorno conserva objetos y enemigos derrotados, pero
  devuelve toda la salud a los enemigos vivos.

## Comprobaciones

`journey.test.ts` comprueba zonas al continuar/reaparecer, ceremonia, muerte con
progreso parcial, fallos de lectura/escritura/borrado y rutas transitables del
cofre desde tres lados, incluida la salida hasta la puerta.

`journey.spec.ts` recorre desde Nueva partida con entradas de teclado, observa
la misma luz guía, pelea contra los enemigos con salud e IA normales, gana los
dos checkpoints, recarga, muere deliberadamente ante el Guardián, regresa,
vence y activa el altar. No teletransporta, concede objetos, cambia salud ni
llama a pasos de simulación en esa prueba. Un controlador de prueba observa el
estado y pulsa teclas DOM por frame; no representa un playtest humano.

Otros dos casos de navegador sí preparan estados específicos para comprobar
almacenamiento deshabilitado y pausa durante la restauración. Los resultados
ejecutados se registran en `VALIDATION.md`.

La duración de 10–15 minutos, la dificultad para alguien que juega por primera
vez y el rendimiento en un Mac siguen requiriendo una sesión con jugadores.
El tiempo del controlador automático no mide esos objetivos.
