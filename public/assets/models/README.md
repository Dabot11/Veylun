# Modelos ejecutables

Actualmente los cuatro personajes se construyen como mallas 3D procedurales
provisionales en `src/assets/characters.ts`. No hay archivos GLB de personajes.

Para sustituirlos, colocar aquí un GLB real optimizado y registrar su ruta y
nombres de clips en `src/assets/assetCatalog.ts`. `VisualOverrides` lo integra
en el juego y conserva la simulación y los controles existentes.

Escala métrica, origen al suelo, Y vertical, frente +Z; aplicar transformaciones
antes de exportar. Las imágenes de referencia permanecen en `design/references/`.
