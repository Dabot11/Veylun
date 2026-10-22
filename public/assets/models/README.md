# Modelos ejecutables

Actualmente los cuatro personajes se construyen como mallas 3D procedurales
provisionales en `src/assets/characters.ts`. No hay archivos GLB de personajes.

La prueba de Ruen / Meshy se realiza primero en `/?inspect=ruen`. Puedes abrir
un GLB local sin subirlo a un servidor o colocar el archivo maestro sin
modificar en `ruen/Meshy_AI_Crimson_Gemwarden_All_Animations.glb` y utilizar el
botón de carga del repositorio. No hay un archivo sustituto en esa ruta.

No activar aún `assetCatalog.ruen.modelPath`: la carga y el arte reales siguen
pendientes de validación. El adaptador genérico `VisualOverrides` no maneja los
clips faltantes ni la mezcla específica que necesita este modelo. Ver
`docs/RUEN_MESHY_INSPECTION.md`.

Referencia del juego: escala métrica, origen al suelo, Y vertical, frente +Z.
En una malla skinned, conservar la jerarquía y las transformaciones importadas;
ajustar escala uniforme y orientación sólo en un contenedor exterior. No
normalizar huesos individualmente. Las referencias 2D permanecen en
`design/references/`.
