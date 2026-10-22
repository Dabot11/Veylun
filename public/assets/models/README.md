# Modelos ejecutables

El MVP normal conserva los cuatro personajes procedurales provisionales.
El master real de Ruen / Meshy está en
`ruen/Meshy_AI_Crimson_Gemwarden_All_Animations.glb`; se conserva intacto.

`/?inspect=ruen` abre el visor aislado. `/?ruen=meshy` activa la prueba jugable
de Walking/Running y mantiene el rig existente para los estados no validados.
La UI distingue la representación utilizada. Ver `docs/RUEN_MESHY_INSPECTION.md`.

La prueba usa `RuenLocomotionView`, no el adaptador genérico `VisualOverrides`.
`assetCatalog.ruen.modelPath` sigue sin activar una sustitución global para
evitar ocultar los estados que todavía necesitan su representación provisional.

Referencia del juego: escala métrica, origen al suelo, Y vertical y frente +Z.
En el GLB se conserva la jerarquía y las transformaciones importadas; escala
uniforme y orientación se ajustan sólo en un contenedor exterior. No normalizar
huesos individualmente ni sobrescribir el master con una optimización.
Las referencias 2D permanecen en `design/references/`.
