# Evidencia de Idle y locomoción equipados

Validación del 22 de octubre de 2026, fecha de America/Monterrey.
**Validación local aprobada; publicación pendiente.**

[Alcance y uso](../../RUEN_GAME_EQUIPMENT.md) ·
[Inventario de originales y copias](runtime-inventory.json).

El escudo se reduce uniformemente del montaje 0.42 a 0.294; los originales
permanecen intactos. El juego carga las copias de distribución y el visor
conserva los masters completos. El inventario registra sus bytes, hashes,
geometría, texturas y diferencias de límites. El resultado final suma 7,608,828
bytes y 122,930 triángulos: 82.9% menos bytes y 86.4% menos triángulos que los
masters. Se revisó el acabado dorado con normales transferidas y mapa horneado
desde la superficie original a la copia, almacenado en PNG 1024² sin pérdida;
color y metal/rugosidad usan JPEG 1024². Dos exportaciones produjeron bytes
idénticos y los hashes originales permanecen intactos.

Typecheck, build y **152 pruebas unitarias en 16 archivos** aprobaron.
La suite completa de navegador aprobó **33 casos**, con un worker y un intento
por caso: cero omitidos, fallos o resultados inestables. Comenzó a las
`2026-10-23T01:56:10.631Z` y duró 1,720,844 ms: **28 min 40.844 s**.
El build conserva el aviso conocido de Vite sobre chunks grandes.

## Resultados

- [Resumen de los 33 casos](validation-summary.json), [log de navegador](browser.log),
  [pruebas unitarias](unit.log) y [typecheck/build](build.log).
- [Inventario cargado en gameplay](equipped-runtime-inventory.json): master,
  tres grupos propios y las dos copias optimizadas.
- [Muestras de las transiciones](equipped-blend-samples.json) y
  [bloqueo por colisión](blocked-locomotion.json).
- [Fallo del escudo y fallback sin equipo](runtime-equipment-failure.json).
- [Solicitudes de producción](production-default-requests.json): carga
  automática del master y las dos copias.
- Consolas sin errores en [gameplay](equipped-gameplay-console.json) y
  [producción](production-default-console.json).

Las pruebas cubren Idle, caminar/correr, agarres, transiciones, pausa, bloqueo
por colisión, fallos de carga, acciones aún sin adaptar y producción sin hooks.
La misma suite comprueba controles, combate, guardado y restauración del
santuario. La calibración geométrica previa comprobó además la punta de la
espada sobre el suelo en muestras de los tres clips propios.

## Capturas

[Idle](gameplay-idle.png) y [Running](gameplay-running.png) proceden de controles
reales del juego con un mando simulado; el personaje y su equipo son visibles.
El escudo al 70% de su tamaño anterior se revisó también en el visor con los
masters originales, de [frente](inspector-shield-reduced-front.png) y de
[lado](inspector-shield-reduced-side.png). El [fallback sin equipo](runtime-equipment-failure-neutral-hero.png)
muestra al Ruen real cuando falla una pieza.

Esta ejecución usó Chromium con SwiftShader y servidores locales de desarrollo
y producción. No mide FPS/memoria en Chrome/macOS del usuario ni comprueba un
Xbox físico o el sitio público. La publicación y su verificación remota siguen
pendientes. Defensa, ataques y otras acciones conservan el rig provisional
hasta adaptar sus animaciones.
