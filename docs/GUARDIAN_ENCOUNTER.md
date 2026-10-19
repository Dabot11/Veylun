# Guardián ancestral y restauración

El cierre del nivel reúne defensa frontal, lectura de un ataque de área y
contraataque. El Guardián conserva sus doce puntos de vida y causa dos puntos
de daño. Alterna dos ataques; no hay una fase adicional ni cambios en el guardado.

## Ataques legibles

| Regla | Golpe frontal | Golpe al suelo |
|---|---|---|
| Preparación | 1,05 s | 1,35 s |
| Dirección fijada desde | 0,55 s | 0,65 s |
| Impacto tras iniciar el movimiento | 0,16 s | 0,22 s |
| Área | Sector de 135°, radio 3,6 m | Círculo de radio 4,3 m |
| Defensa | Escudo de frente, esquiva o salir del sector | Salir del círculo, rodada al impacto o salto con altura suficiente |
| Recuperación inmóvil | 1,9 s | 2,4 s |

`enemies/guardianCombat.ts` define los tiempos y áreas que consumen simulación,
poses, señales del suelo y HUD. El límite exterior permanece fijo durante la
preparación; un aro interior muestra la carga. Un brazo elevado indica el golpe
frontal, ambos brazos el golpe al suelo. Las señales de sonido también difieren.
La caída de los brazos, el sonido de impacto y el daño se sincronizan con el
mismo instante. Cada ataque puede causar daño una sola vez.

Los golpes respetan sólidos y altura. El escudo no detiene el ataque de área;
la rodada mantiene sus 250 ms normales de invulnerabilidad. El Guardián conserva
su ritmo al recibir daño y no se desplaza durante preparación ni recuperación.
El panel indica cuándo está expuesto y muestra la vida restante con texto y una
barra accesible. El encuadre admite su tamaño incluso sin fijar objetivo.

Salir de la arena cancela el ataque pendiente. Al regresar empieza una
preparación completa, evitando un impacto heredado sin aviso. Esto no recupera
la salud del jefe; morir o volver al checkpoint sigue reiniciando el combate.

## Derrota y altar

Al caer, el Guardián se arrodilla y se desvanece. Sus avisos se apagan y el altar
se señala con un haz, un diamante y un aro. La guía indica E o Y según el control.
La disponibilidad deriva de `bossDefeated` y `altarActivated`: se conserva al
continuar una partida, sin abrir una victoria por proximidad ni por matar al jefe.

Interactuar con el altar orienta a Ruen, detiene su movimiento e inicia los tres
segundos de restauración. Una onda se expande, ocho luces ascienden y convergen,
la iluminación se vuelve más cálida y el HUD muestra el progreso. Después aparece
la victoria. Cargar una partida completada conserva el aspecto restaurado;
iniciar otra aventura restablece iluminación y efectos.
Los enemigos guardados como derrotados comienzan con su animación de muerte ya
terminada, para que no reaparezcan al continuar ni queden visibles en la victoria.

Las señales y luces se crean una vez y se reutilizan; no se generan mallas en
cada ataque. El arte sigue siendo procedural y provisional.

## Comprobaciones

`guardianCombat.test.ts` cubre alternancia, dirección fija, instante y frecuencia
del daño, escudo frontal/trasero, límites del sector, retirada, salto, rodada a
tiempo y anticipada, cobertura, reentrada a la arena, combo real en recuperación,
muerte, persistencia, ceremonia, geometría, reutilización de efectos, poses y
encuadre en 800 × 600 y 390 × 844, con y sin objetivo fijado.

`guardian.spec.ts` prepara el progreso anterior y la posición de entrada. Conserva
los doce puntos de vida y la IA del jefe. Teclado o Gamepad API simulado realizan
tres combos, dos bloqueos, retirada del área, aproximación e interacción con el
altar. No se concede daño ni salud desde la preparación. El caso de teclado
también recarga la partida completada. Ver `VALIDATION.md` para resultados reales
y límites de las comprobaciones en el entorno cloud.

Otra prueba de navegador carga directamente una partida completada: comprueba
que el Guardián siga oculto y que «Nueva aventura» restablezca su vida, visibilidad,
niebla y luces. Los combos automáticos pulsan teclas DOM o botones de mando en
frames de animación, sin esperar al HUD ni modificar la simulación.
