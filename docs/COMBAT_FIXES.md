# Corrección de combate — 19 de octubre de 2026

Reporte: la espada golpeaba hacia atrás y el ataque no dañaba al enemigo.

| Error reproducido | Corrección |
|---|---|
| La espada quedaba detrás durante los frames de daño de los tres golpes | Preparación, barrido y recuperación usan las ventanas de combate; la rotación del brazo mantiene la hoja delante |
| Girar y atacar en el mismo tick conservaba la orientación anterior | Se aplica la dirección de movimiento al iniciar el golpe; el objetivo fijado tiene prioridad |
| Una segunda pulsación durante los primeros 80 ms se perdía | Se conserva la petición del siguiente golpe desde la preparación, sin encolar cadenas ilimitadas |
| Una pulsación justo antes de terminar la esquiva se descartaba | Buffer breve de 150 ms; las pulsaciones antiguas caducan |
| La espada podía dañar a través de un pilar | El segmento de ataque comprueba los obstáculos sólidos activos |
| Saltar y esquivar simultáneamente cancelaba la rodada | La esquiva resuelve su prioridad antes de comprobar el salto |

Regresiones en `tests/unit/combatRegression.test.ts`: daño al girar, pulsación
rápida, entrada anticipada y caducidad, interrupción por daño, prioridades,
obstrucciones y transformaciones reales de la hoja en las tres animaciones.
Una pulsación aislada sigue causando un solo ataque.

`tests/browser/combat.spec.ts` prepara un Brote a alcance y deja su IA en
recuperación mientras teclado, clic izquierdo o Xbox simulado generan los
ataques. Verifica la secuencia de salud 3 → 2 → 1 → 0 y el registro de su muerte.
La prueba no concede daño ni invoca `damageEnemy`.

No cambia el esquema de guardado: el progreso anterior sigue siendo compatible.
Las comprobaciones de mando usan la API simulada; el hardware físico permanece
pendiente. Ver `VALIDATION.md` para los resultados ejecutados.
