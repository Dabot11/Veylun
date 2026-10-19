# Encuentro del Espíritu errante

El segundo combate enseña a leer un ataque a distancia, defenderse y aprovechar
la recuperación. Conserva la salud de dos puntos y el daño de un punto por
proyectil; no cambia el esquema de guardado ni añade nuevas zonas.

## Ritmo y señales

1. Persigue o se retira para mantener espacio, siempre mirando a Ruen.
2. Con línea de visión, prepara magia durante 950 ms: esfera creciente, aletas
   recogidas, marcas de dirección en el suelo y señal de sonido ascendente.
3. A los 500 ms fija la dirección. Moverse a un lado permite evitar la trayectoria;
   el proyectil no persigue al jugador después de dispararse.
4. Dispara a 4,2 m/s. El núcleo luminoso y la estela permiten seguirlo. El HUD
   diferencia preparación, magia en camino y agotamiento; admite teclado y Xbox.
5. Tras 180 ms de liberación, queda quieto durante 2,8 s, baja las aletas y muestra
   un aro de recuperación. Desde seis metros hay tiempo para bloquear, acercarse
   y golpear antes de que vuelva a moverse.

Los impactos de espada mantienen su pausa breve. El escudo protege solo de
frente; la rodada conserva su ventana de invulnerabilidad de 250 ms.

## Colisión y fin del combate

La magia comprueba todo el tramo recorrido en cada tick. Se calcula cuál ocurre
primero: impacto contra un sólido o contacto con el cuerpo de Ruen. Los sólidos
se amplían por el radio del proyectil y respetan su altura. Así una pared fina
protege incluso ante una velocidad alta, pero no absorbe un golpe que alcanza
primero al jugador situado delante de ella.

Cada proyectil identifica a su emisor. Derrotar al Espíritu disipa su magia y
avisa de que el interruptor está libre. Un haz, un diamante y un aro iluminan
el cristal, acompañados de una indicación en pantalla. La reja se abre solo
al acercarse e interactuar. La guía reaparece al continuar una partida pendiente
del interruptor y desaparece después de activarlo.

Las mallas de cuatro disparos se crean una sola vez y se reutilizan. La cadencia
actual de un único Espíritu no llena ese pool. Las señales de carga y dirección
se ocultan al disparar, morir o dejar el modo de juego.

## Comprobaciones

`spiritCombat.test.ts` cubre dirección fija, retirada mirando al jugador,
cobertura, bloqueo y contraataque desde seis metros, colisiones barridas,
prioridad de contacto, altura, escudo frontal/trasero, esquiva, salto, caducidad
del aviso de peligro, muerte, persistencia del interruptor y reutilización de
mallas. El recorrido completo del nivel continúa cubierto por comandos normales
de la simulación, sin conceder daño, salud ni objetos en esa prueba.

`spirit.spec.ts` parte de un estado preparado tras los Brotes, conserva la IA
y salud del Espíritu y realiza bloqueo, aproximación, dos golpes y activación
del interruptor mediante teclado o Gamepad API simulada. Usa el ajuste normal
de sombras desactivadas para limitar el coste del renderizado por software.
Las otras pruebas y la revisión de carga también cubren sombras activadas.

Ver `VALIDATION.md` para resultados y límites. El mando físico, el rendimiento
en macOS y el ajuste de dificultad con jugadores siguen pendientes.
