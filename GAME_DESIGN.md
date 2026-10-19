# Diseño de juego — especificación del MVP

Este documento conserva las reglas del brief implementadas en el MVP. Los
modelos y las animaciones son provisionales. La duración objetivo y el
rendimiento en Chrome/macOS deben medirse con jugadores y hardware real.

## Once decisiones de diseño tomadas del brief

1. Aventura de acción y exploración 3D original, un jugador, navegador Chrome
   en macOS; primer nivel de aproximadamente 10–15 minutos.
2. Mundo llamado Veylun, protagonista Ruen y nivel El Santuario Olvidado;
   todos conservan su condición de nombres de trabajo.
3. Fantasía estilizada moderna: naturaleza antigua, ruinas con musgo, luz
   cálida y magia turquesa. El claro adjunto guía el lenguaje de las cinco zonas.
4. Ruen juvenil y compacto, cabello cobrizo, capa marfil, ropa verde/cuero,
   espada y escudo propios; rasgos tomados de las seis referencias revisadas.
5. Xbox Wireless Controller como control principal, teclado/ratón secundario;
   acciones abstractas, flancos de pulsación y diagnóstico de mapping.
6. Movimiento relativo a cámara, salto simple, gravedad, aceleración,
   colisiones, coyote time, buffer y rodada direccional.
7. Cámara libre de seguimiento con obstáculos y Z-targeting intercambiable.
8. Espada con combo de tres golpes, escudo frontal y esquiva con invulnerabilidad;
   sin parry ni ataques cargados. Cinco corazones, dos unidades por corazón.
9. Dos Brotes corruptos, un Espíritu errante y un Guardián ancestral de dos
   ataques, sin segunda fase.
10. Cinco zonas continuas, secuencia espíritu → interruptor → reja → cofre →
    llave → puerta → jefe → altar; exactamente dos checkpoints.
11. Guardado local versionado, progreso persistente tras morir y victoria
    exclusivamente después de interactuar con el altar desbloqueado.

Esta enumeración organiza requisitos existentes; no añade aprobaciones
visuales ni decisiones comerciales que el usuario no haya dado.

## Recorrido

| Zona | Objetivo | Reglas |
|---|---|---|
| Claro del despertar | Explora el bosque | Inicio seguro, plataforma circular, aprendizaje libre |
| Sendero de las raíces | Derrota a las criaturas del sendero | Dos Brotes; checkpoint 1 después del combate |
| Patio de las ruinas | Encuentra la llave del santuario | Espíritu, interruptor, reja, cofre y llave en orden |
| Puerta del santuario | Abre el santuario | Interacción explícita con llave; checkpoint 2 antes del jefe |
| Cámara del Guardián | Restaura el santuario | Derrotar guardián, acercarse y activar altar |

## Enemigos

| Enemigo | Vida | Daño | Comportamiento |
|---|---|---|---|
| Brote corrupto | 3 golpes normales | 1 unidad | Patrullar, detectar, perseguir, anticipar, embestir, recuperarse |
| Espíritu errante | 2 golpes normales | 1 unidad | Flotar, mantener distancia, anticipar y lanzar proyectil lento bloqueable |
| Guardián ancestral | 12 golpes normales | 2 unidades | Golpe frontal y golpe al suelo con área visible, anticipación y recuperación |

La silueta del Brote debe ser vegetal, encorvada y asimétrica; no canina.
El guardián recupera toda la salud al morir Ruen durante la pelea. Al derrotarlo
se habilita el altar, pero no se dispara victoria.

## Combate y movimiento

Parámetros iniciales centralizados en `src/config/gameConfig.ts`: caminar
2.2 m/s, correr 4.8 m/s, salto 1.3 m, gravedad −18 m/s², coyote 0.10 s,
buffer 0.12 s. Colisiones con árboles, piedra, paredes y puertas; caída fuera
del mapa devuelve a posición segura.

Ataques con preparación, ventana activa y recuperación. Máximo tres golpes,
el tercero más potente. Cada objetivo recibe como máximo un impacto por
golpe; detectar alcance, orientación y volumen. Escudo frontal de 110°;
rodada de 0.45 s con invulnerabilidad inicial de 0.25 s y recuperación breve;
invulnerabilidad tras daño de 0.7 s.

## Persistencia y muerte

El inicio no cuenta como checkpoint. Al morir: salud completa, restaurar
cámara y controles; conservar llave, interruptores, cofre, reja, puerta y
enemigos ordinarios derrotados. Persistir versión, checkpoint, zona alcanzada,
progreso, jefe, altar, victoria, tiempo y muertes. Validar datos corruptos y
requerir confirmación antes de borrar progreso.

## Interfaz, sonido y victoria

HUD minimalista con corazones, objetivo, interacción contextual, marcador de
objetivo, vida del jefe y avisos de checkpoint. Inicio con nueva partida y
continuar; pausa con reanudar, checkpoint, cámara, volumen, controles y reinicio.
Audio original sintetizado tras gesto del usuario. Victoria «Santuario
restaurado», animación, tiempo, muertes y regreso al menú.

**Implementado actualmente:** recorrido conectado, combate, tres tipos de
enemigo, acertijo, llave/puerta, checkpoints, persistencia y victoria por altar.
Consultar `docs/ACCEPTANCE.md` para evidencias y límites de validación.
