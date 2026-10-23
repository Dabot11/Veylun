# Evidencia de las acciones restantes de Ruen

Estado: **validado y publicado desde `f0402306`**.
[Alcance de la etapa](../../RUEN_COMPLETE_ACTIONS.md) ·
[Registro de despliegue](../../DEPLOYMENT.md).

La revisión cubre daño, muerte, interacción, victoria, seis variantes de
caminar/correr hacia los lados y atrás, ataques/defensa en el aire, defensa
durante el aterrizaje y bloqueo temporal durante la interacción. Conserva
las reglas de la simulación, los cinco GLB, los 20 clips originales y el
escudo al 70%.

## Comprobaciones cerradas

Typecheck, build y **234 pruebas unitarias en 20 archivos** aprobaron.
Las unitarias terminaron en 5.67 s y el build en 861 ms; permanece el aviso
conocido de chunks grandes de Babylon. [Unitarias](unit.log) · [Build](build.log).
Los [SHA-256 de los cinco GLB](asset-hashes.json) coinciden con los inventarios
de la fuente publicada `b83b0f36`.

La [calibración aislada](calibration-summary.json) muestreó el cuerpo y ambas
armas a 60 Hz, incluyendo el último fotograma de cada clip: **523 poses de
diez clips**, 43 grupos, 20 originales y cero errores de página. El mínimo del
cuerpo fue −0.0008645 unidades, dentro de la tolerancia de 0.01; ambas armas
quedaron sobre el suelo. La revisión inicial detectó la capa de muerte a
−0.0455307; se corrigió el apoyo usando superficies medidas de capa y botas.

La [calibración del adaptador](runtime-contact-summary.json) usa pasos manuales
de `Simulation` a 60 Hz y las mallas reales. Sus **915 muestras de diez
escenarios** aprobaron: cero fallbacks, diferencia de raíz igual a cero y
ningún contacto por debajo de la tolerancia de 0.01. El peor mínimo fue
−0.0007373 unidades. Se corrigieron los apoyos de muerte y los de interacción
en movimiento (mínimo inicial −0.0301449), además de la salida hacia carrera
(−0.0119), conservando el apoyo y la fase de las piernas al mezclar el torso.

Estas auditorías son calibración manual, separada de las pruebas desde
controles. Las capturas seleccionadas documentan poses del visor:

- [Daño de lado](hurt-side.png), [interacción](interact-front.png) y [victoria](victory-front.png).
- [Muerte de frente](death-rest-front.png) y [desde atrás](death-rest-back.png).
- [Carrera lateral](run-right-front.png) y [hacia atrás](run-back-side.png).

## Navegador: 13 casos seleccionados aprobados

Aprobaron **13 de los 51 casos disponibles**: siete nuevos y seis regresiones,
con 11 de desarrollo y dos de producción. No se ejecutó el catálogo completo.
El [resumen de navegador](browser-summary.json) conserva los resultados de
cada caso y las tres corridas:

| Corrida | Resultado | Duración |
| --- | --- | --- |
| Siete nuevos | 7 aprobados | 553,251.823 ms |
| Seis regresiones | 5 aprobados, 1 fallido | 718,760.412 ms |
| Repetición aislada del escudo ausente | 1 aprobado | 54,869.184 ms |

Doce casos aprobaron al primer intento. El del escudo ausente leyó
`isPlaying` antes del primer paso de animación tras reanudar, aunque el estado
ya era `ready` y el peso Idle era 1. Se añadió una espera de reproducción,
conservando la aserción de `Ruen_Idle_Unarmed` y todas las comprobaciones de
respaldo; sólo se repitió ese caso. La aplicación, los activos y el build
permanecieron intactos. El [manifiesto de 97 archivos](source-manifest.sha256)
registra la fuente probada. Logs: [nuevos](browser-new.log),
[regresiones](browser-regression.log) y [repetición](browser-partial-retest.log).

El [resumen de regresiones](regression-checks.json) registra el respaldo sin
escudo, producción, combo, interrupciones y el recorrido completo `journey`,
que aprobó con 79.0 s simulados y una muerte deliberada. El
[resumen de acciones](actions-checks.json) reúne 51 muestras
del visor, relojes, ocho repeticiones de simulación y controles reales. Las
repeticiones no encontraron diferencias funcionales en el controlador, y los
registros de acciones no contienen errores de aplicación. Se comprobaron las
seis combinaciones direccionales desde mando simulado y la guardia durante
el aterrizaje, además del ataque y bloqueo aéreos.

Capturas desde controles reales: [daño](gameplay-hurt.png),
[muerte en curso](gameplay-death.png), [interacción con cofre](gameplay-interact-chest.png),
[victoria en curso](gameplay-victory.png), [caminar a la izquierda](gameplay-walk-left.png),
[correr a la izquierda](gameplay-run-left.png), [ataque aéreo](gameplay-air-attack.png)
y [bloqueo aéreo](gameplay-air-block.png). Las capturas muestran muerte/victoria
en curso y locomoción izquierda; la calibración documenta sus poses terminales
y las seis direcciones. Las pruebas con controles verifican las seis
combinaciones, aunque no todas tienen captura individual.

Las comprobaciones locales usan renderizado de software. No miden FPS en el
hardware del usuario. La confirmación de despliegue y la prueba directa del
sitio público se distinguen de estos resultados locales.

El manifiesto probado se conserva en `source-manifest.sha256`. Después de la
validación se retiró únicamente una línea vacía final de `ruenPoseAuthoring.ts`;
[el manifiesto final](final-source-manifest.sha256) registra ese ajuste de formato.

## Publicación

El [PR #7](https://github.com/Dabot11/Veylun/pull/7) se integró en la fuente
`f0402306009e6b4362232d959574e61219939b2e`, cuyo árbol coincide con el feature
`07d8e61813af8210e9b148f9ad06ec157da7abc7`. El build subido a `gh-pages` es
`4556fc5393c0b3018e04af8bb79f9cce063ec7bc`, creado el
`2026-10-23T08:12:55.072Z`.
[Actions 39923103610](https://github.com/Dabot11/Veylun/actions/runs/39923103610)
terminó con **Success**; build, deploy, report-build-status y Deploy to GitHub
Pages aprobaron. El marcador remoto del commit confirma fuente y fecha.
[Verificación](deployment-verification.json) · [Log](deploy.log).

[Jugar](https://dabot11.github.io/Veylun/?v=f0402306) ·
[Visor de acciones](https://dabot11.github.io/Veylun/?inspect=ruen&motion=actions-v1&v=f0402306).
La verificación pública usa Actions y el marcador remoto; el dominio no se
abrió en navegador por las restricciones de red. Las pruebas de desarrollo
y producción fueron locales. Los cambios documentales posteriores conservan
este build.
