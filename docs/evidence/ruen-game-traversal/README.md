# Evidencia de salto y voltereta equipados

**197 unitarias y 22 casos seleccionados de navegador aprobados; publicado desde `b83b0f36`.**

[Alcance de la etapa](../../RUEN_GAME_TRAVERSAL.md).

Typecheck, build y **197 pruebas unitarias en 18 archivos** aprobaron; las
unitarias tardaron 4.56 s y Vite 1.21 s. El build conserva el aviso conocido
de chunks grandes. [Unitarias](unit.log) · [Typecheck/build](build.log).
Los [cinco GLB conservan sus hashes](asset-hashes.json) respecto a `f828d841`.

## Calibración manual

La auditoría de malla completa detectó inicialmente mínimos aproximados de
−0.04 al aterrizar y −0.098 en la voltereta. Se corrigieron los apoyos de pies
y la trayectoria de la capa dentro de los clips. El [muestreo final](poses.json)
registra mínimos de aproximadamente **−0.000807** para aterrizaje y
**−0.001047** para voltereta, dentro de la tolerancia de contacto de 0.01
unidades; el equipo permanece sobre el suelo.

Capturas de poses seleccionadas: salto de [frente](jump-front.png) y
[espalda](jump-back.png), [aterrizaje lateral](land-side.png), y voltereta en
[entrada](roll-entry-front.png), [inversión](roll-inverted-side.png) y
[recuperación](roll-recover-back.png). Son una auditoría de poses y superficies,
no una prueba de controles ni una medición de rendimiento.

La [comprobación inicial de la transición](runtime-contact-before.json) detectó
una penetración de aproximadamente 21.8 mm a los 0.0333 s de la voltereta.
La entrada se corrigió para conservar el apoyo de pelvis/piernas y mezclar
sólo la parte superior del cuerpo. La [comprobación final](runtime-contact-final.json)
aprobó las 130 muestras sin penetraciones mayores de 0.01 unidades. Los 28
muestreos de voltereta tuvieron mínimo −0.000893 y los ocho de aterrizaje
−0.000689. Son muestras controladas del adaptador, no una prueba desde inputs.

## Primera tanda de navegador

Los cuatro casos nuevos terminaron con **3 aprobados y 1 fallido** en
195,177.346 ms. El fallo
de Shift estaba en el filtro del test: comparaba la Z durante la voltereta
con la posición posterior en Idle. Cuatro renders de voltereta permanecieron
en Z≈89.2333333 con velocidad solicitada 8 y fotogramas 5 → 11 → 17 → 23;
después, Idle avanzó hasta Z≈89.316945 mediante pasos menores. La repetición
de 48 pasos contra la simulación dio diferencia 0.

Se corrigió sólo el filtro para comparar `ΔZ < 1e-9` entre muestras consecutivas
de voltereta con velocidad solicitada mayor de 7.99, conservando las demás
comprobaciones. La aplicación y el build no cambiaron. La repetición de Shift
aprobó en **70,114.356 ms**; los cuatro casos nuevos quedan aprobados.

## Cierre de navegador

Las **18 regresiones aprobaron** en **909,382.454 ms**, sin omitidos, fallos ni
resultados inestables. El resultado conjunto es **22 casos únicos aprobados**:
cuatro nuevos, incluida la repetición de Shift, y 18 regresiones.
[Resumen de casos e historial](browser-summary.json) ·
[Comprobaciones de movimiento](traversal-checks.json).

Logs: [tanda nueva](browser-new.log), [repetición de Shift](browser-shift-retest.log)
y [regresión](browser-regression.log). Capturas del juego desde controles:
[salto](gameplay-jump.png) y [voltereta con objetivo fijado](gameplay-roll-lock-on.png).
El [visor lateral de voltereta](preview-roll-side.png) es una vista previa;
las auditorías manuales de arriba documentan contacto y recorrido de poses.

La selección comprueba salto completo, caída sin impulso desde una altura
preparada, dirección de voltereta, pausa, interrupciones, invulnerabilidad,
fallbacks y continuidad con combate. Las pruebas de la versión `f828d841`
corresponden al combate anterior.

Esta selección cubre 15 casos de desarrollo y siete de producción. No repite
la suite completa de 44 casos ni el recorrido `journey` y los encuentros de
enemigos restantes; sus resultados anteriores se conservan como históricos.
Las pruebas se ejecutaron en servidores locales con Chromium y renderizado
de software; no miden FPS en el equipo del usuario ni prueban hardware Xbox.

## Publicación

El [PR #6](https://github.com/Dabot11/Veylun/pull/6) integró la revisión probada
`a0384329a161faf414aba265c88ade1f37c1d975`. La fuente publicada
`b83b0f365e84555de195466c9d6f2c8aaad79dcf` tiene exactamente el mismo árbol.
El commit de `gh-pages` es `df6b2d858e945fdd893b0be42a0e1a01426f1a51`; su
marcador remoto confirma esa fuente y el build de `2026-10-23T06:50:54.272Z`.
[Actions 39914027016](https://github.com/Dabot11/Veylun/actions/runs/39914027016)
terminó con **Success**, actualizado a las `2026-10-23T06:51:49Z`, con todos
los jobs y el paso de despliegue aprobados.
[Verificación](deployment-verification.json) · [Log de publicación](deploy.log).

La confirmación remota usa Actions y el marcador del commit. El dominio
público no se abrió en navegador por la restricción de red; desarrollo y
producción se probaron localmente. Los cambios documentales posteriores no
modifican ese build. La reversión del PR #6 y su base anterior están en el
[registro de despliegue](../../DEPLOYMENT.md).
