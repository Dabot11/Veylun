# Aceptación del MVP

## Implementado

- [x] Nueva partida, continuar guardado válido y borrado con confirmación.
- [x] Ruen visible con modelo 3D provisional y quince estados de animación.
- [x] Cinco zonas conectadas y recorrido completo bosque → altar.
- [x] Movimiento relativo a cámara, salto simple, gravedad, aterrizaje,
      aceleración, colisiones, coyote time y buffer de salto.
- [x] Combo de tres golpes con ventanas, escudo frontal, esquiva e invulnerabilidad.
- [x] Z-targeting, cambio de enemigo y liberación automática.
- [x] Dos Brotes, un Espíritu con proyectiles y Guardián de dos ataques.
- [x] Espíritu → interruptor → reja → cofre → llave → puerta.
- [x] Dos checkpoints, reaparición segura y progreso conservado.
- [x] Reinicio de pelea del Guardián tras muerte; muertos ordinarios persistentes.
- [x] Altar bloqueado antes del jefe; victoria solo tras interacción y restauración.
- [x] HUD, pausa, ajustes, controles, pantalla de victoria, tiempo y muertes.
- [x] Guardado local versionado y tolerancia a datos corruptos/fallo de storage.
- [x] Teclado y ratón; Xbox estándar mediante Gamepad API y diagnóstico de mapping.
- [x] Efectos de sonido sintetizados tras gesto, volumen ajustable.
- [x] TypeScript estricto y build estático con rutas relativas.
- [x] Referencias clasificadas, manifest y documentación de estado real.
- [x] Master real de Meshy conservado y 20 clips inventariados; Walking/Running
      revisados en el visor y conectados a la prueba opcional `?ruen=meshy`.
      Ver [evidencia y límites](RUEN_MESHY_INSPECTION.md).

## Cobertura de las 23 pruebas solicitadas

| Requisitos | Evidencia |
|---|---|
| 1–3 Movimiento, salto, colisión | `gameplay.test.ts`: aceleración, salto/aire/buffer, puertas/reja/sello/árbol y caída inválida |
| 4 Cámara | `camera.test.ts`: seguimiento, reset y reducción/recuperación ante puerta |
| 5 Fijar y liberar objetivo | Cambio y liberación tras muerte de objetivo |
| 6 Combo | Límite de tres y recuperación; un impacto por enemigo y orientación |
| 7–8 Escudo y esquiva | Arco frontal, daño trasero, área no bloqueable e invulnerabilidad acotada |
| 9–11 Enemigos | Daño/muerte en los tres tipos, embestida, proyectiles y dos ataques del jefe |
| 12–15 Checkpoints y muerte | Activación por eventos, restauración, conservación y enemigos derrotados |
| 16–17 Cofre y puerta | Secuencia con prerrequisitos y necesidad de interacción explícita |
| 18 Reinicio del jefe | Salud completa después de morir Ruen |
| 19–20 Altar y victoria | Rechazo antes del jefe, ausencia de victoria por mera muerte/proximidad y restauración tras interactuar |
| 21 Persistencia | Roundtrip, esquemas dañados, fallos de almacenamiento y nueva simulación; recarga en Chromium |
| 22 Teclado/ratón | Controles y menús en navegador; recorrido íntegro en simulación y Chromium, con muerte y recargas |
| 23 Xbox | API y mapping estándar con mando simulado; pendiente hardware físico |

La prueba de recorrido completo usa comandos de movimiento, ataques y
interacción normales; no concede llave, salud ni daño durante ese recorrido.
Las pruebas aisladas crean estados específicos para verificar reglas.

## Pendiente de validar o mejorar

- [ ] Control Xbox físico en Chrome/macOS (conectar, desconectar, gatillos,
      deadzone, cambio de objetivo y completar el recorrido).
- [ ] Rendimiento de 60 FPS en hardware de gama media; el entorno cloud usa
      renderizado de software y no representa una GPU de Mac.
- [ ] Duración de 10–15 minutos mediante playtests; la versión es compacta y
      un jugador que conoce el recorrido puede completarla antes.
- [ ] Arte y animación definitivos: los cuatro modelos y el escenario son
      provisionales y simplifican las ilustraciones.
- [ ] Revisión de los otros 18 clips Meshy, clips faltantes y ajuste final de
      contacto/deslizamiento de pies; sólo Walking/Running entran en gameplay.
- [x] Publicación del MVP previo en GitHub Pages, confirmada por su despliegue.
      La prueba Meshy de esta rama todavía no se ha publicado allí.
- [x] Recorrido completo automatizado en Chromium desde Nueva partida hasta
      restaurar el altar, con muerte deliberada y recargas entre checkpoints.
- [x] Guía transitable al cofre y salida, continuación sin almacenamiento local
      durante la sesión y pausa/reanudación de la ceremonia.
- [x] Primera revisión procedural de Ruen y del claro: capa, cabello, equipo,
      codos/rodillas, losas, vegetación y sombras locales. Ver `ART_PASS.md`.
- [ ] Restauración de una nueva tarea cloud.

Consultar `VALIDATION.md` para el resultado de las ejecuciones reales.
