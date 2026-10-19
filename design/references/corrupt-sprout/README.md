# Brote corrupto — referencias revisadas

Seis PNG originales extraídos del ZIP individual; nombres, dimensiones y SHA-256
en `inventory.json`. Se revisaron las seis imágenes. Las carpetas `__MACOSX`
se descartaron como metadatos; las imágenes se conservaron sin editar.

## Vistas

Sufijos de archivo: 1 tres cuartos, 2 frontal, 3 lateral, 4 tres cuartos contrario, 5 embestida aérea, 6 tres cuartos de guardia. Las imágenes son conceptuales, no clips ni modelos.

## Rasgos observados

Cuerpo de raíces compacto y muy encorvado. Cabeza grande, baja y con máscara de corteza en punta; ojos oblicuos ámbar. Brazos delanteros desproporcionadamente grandes, manos con garras de madera y patas traseras pequeñas. Musgo, hojas verdes/ocre y espinas rojizas sobre el lomo. Sin hocico ni orejas de perro.

## Especificación del provisional

- Escala: 1.1 m al lomo como escala inicial de gameplay; el brief sugería ajustar tras revisar.
- Materiales: Marrón corteza, madera ocre, musgo oliva, espinas terracota y ojos ámbar emisivos.
- Articulación y acciones: Cuerpo, cabeza y brazos delanteros; patrulla, persecución, anticipación inclinada, embestida, recuperación, impacto y colapso.

La representación del juego se genera con mallas originales en
`src/assets/characters.ts`. Conserva silueta, paleta y rasgos principales;
es una simplificación provisional, sin el microdetalle de las ilustraciones.
No se recibió ni se afirma una conversión automática a GLB. El catálogo y
`VisualOverrides` permiten sustituirla por un GLB con clips mapeados.
