# Idle con equipo: evidencia del prototipo

22 de octubre de 2026. Capturas reales de Chromium del Idle equipado sobre
el master intacto de Ruen y los dos GLB entregados. Muestran la revisión final
del montaje, con espada en la mano derecha y escudo en la izquierda.

| Frontal | Lateral | Trasera |
| --- | --- | --- |
| ![Frontal](idle-equipped-front.png) | ![Lateral](idle-equipped-side.png) | ![Trasera](idle-equipped-back.png) |

[Vista en tres cuartos](../../images/ruen-equipped-idle.png) ·
[Inventario de los originales](source-inventory.json) ·
[Uso y alcance](../../RUEN_EQUIPMENT_PREVIEW.md).

Typecheck, build, **142 pruebas unitarias en 15 archivos y 10 casos únicos de
navegador** aprobaron tras el ajuste final. Las dos ejecuciones de navegador
terminaron sin reintentos ni cambios de aplicación: nueve casos en 6.1 minutos
y uno en 28.5 segundos. [Registro de ejecución](browser.log).

- Tres casos del equipo real: carga automática, seguimiento de manos, loop,
  comparación con el Idle neutro, restauración de poses, liberación de recursos,
  fallo/reintento y controles en producción sin hooks de desarrollo.
- Tres regresiones del Idle neutro y tres del visor con fixture sintético.
- Un caso adicional del master real en el visor original, con Walking/Running.

Las pruebas usaron Chromium con renderizado de software y servidores locales
de desarrollo y producción. La publicación está pendiente; no se presenta
esta ejecución como comprobación del sitio remoto.

El montaje y los materiales se revisaron de frente, lado y espalda. La
calibración terminó sin errores de aplicación. El script de capturas agotó
el tiempo en un primer intento; terminó al capturar con render pausado.
Ese incidente de captura no se interpreta como una validación de rendimiento.

Los originales conservan geometría, materiales, texturas y hashes. Los
906,832 triángulos del equipo corresponden a esta prueba sin optimización.
El prototipo permanece fuera del gameplay; la aprobación artística, las
transiciones jugables y el rendimiento en el equipo del usuario siguen pendientes.
