# Dirección artística

## Referencias observadas

Se revisaron las seis imágenes de cada uno de los cuatro personajes y la
imagen del Claro del despertar visible en el chat. Las fichas de cada carpeta
`design/references/<id>/README.md` describen vistas, rasgos y normalizaciones.
No se ha convertido automáticamente ninguna ilustración en un modelo 3D.

El claro de referencia tiene plataforma circular baja, anillos de losas,
arcos rotos, pilares erosionados, grandes raíces, musgo, helechos, flores
claras, cascadas y profundidad de acantilados. La luz es cálida, la vegetación
mezcla verdes bosque y amarillos y las runas aportan acentos turquesa.

## Personajes

- **Ruen:** juvenil, compacto, ojos marrón ámbar y cabello cobrizo de mechones
  curvos. Capa marfil con capucha, motivos verde azulado y faldones de forro
  petróleo; prendas oscuras, cuero, herrajes cálidos y gemas turquesa. Escudo
  apuntado con gema romboidal y espada propia. Para consistencia se normaliza
  espada derecha/escudo izquierdo: las ilustraciones varían su lateralidad.
- **Brote corrupto:** cuerpo de raíces muy encorvado, cabeza grande y baja,
  máscara de corteza, ojos ámbar, manos delanteras enormes y patas traseras
  pequeñas. Musgo, hojas oliva/ocre y espinas terracota; sin hocico canino.
- **Espíritu errante:** núcleo luminoso turquesa, ojos grandes con órbitas
  oscuras, máscara de madera en V y gema frontal. Corona de hojas, aletas
  y cola de energía. Flota; no tiene patas.
- **Guardián ancestral:** coloso humanoide de raíces entrelazadas y placas
  pétreas. Hombros, antebrazos y manos enormes; máscara vertical, ojos y runas
  turquesa; vegetación sobre hombros y articulaciones. La pose de extensión
  de raíces se interpreta como referencia anatómica, no añade un tercer ataque.

## Implementación actual

Modelos originales construidos con mallas curvadas, volúmenes articulados,
placas, hojas y tubos de raíces; texturas procedurales de corteza, piedra y tela.
Los rasgos anteriores se representan con geometría tridimensional y animación
por código. El estilo resultante es estilizado y simplificado: no reproduce
el microdetalle, materiales complejos ni la calidad de las ilustraciones.

Cinco zonas continuas comparten piedra antigua, vegetación y turquesa; el
sendero tiene raíces, el patio alberga el acertijo y el santuario una arena
más despejada. La reja y la puerta se abren visualmente y sus colisiones se
retiran. Los aros ámbar anticipan ataques y la luz guía indica la ruta siguiente.
El HUD evita ocupar el centro de combate; corazones, objetivo e interacción
usan colores claros y tipografía simple.

## Primera revisión de Ruen y del claro

Ruen conserva su altura aproximada y la convención espada derecha/escudo
izquierdo. `assets/ruen.ts` construye mechones curvos afinados, rostro con
mandíbula y boca, capa continua de doble capa con emblema dorsal, capucha,
arnés cruzado, bolsillos, frasco, rodillera y herrajes sin emisión. Las gemas
son rombos facetados y la hoja tiene filo y nervadura. La espada se inclina
hacia fuera en reposo para mantener la punta sobre el suelo.

El movimiento incluye codos y rodillas, flexión al saltar y aterrizar, postura
recogida al rodar y escudo adelantado. El ciclo de carrera sigue la velocidad;
los tres ataques conservan sus tiempos y orientación de impacto. La capa se
mueve desde su anclaje, sin simulación física de tela ni esqueleto con skinning.

El Claro del despertar tiene dos anillos de losas con juntas, grabados bajos,
sendero de piedras, helechos de frondas divididas, flores azul marfil, hiedra y
musgo en los pilares existentes. Las copas cercanas y el primer arco proyectan
sombras cuando están activadas. El acceso central permanece despejado y no se
añaden obstáculos a la simulación.

## Mejoras siguientes

Refinar el rostro y la escultura de corteza/piedra; extender la vegetación del
claro al resto del recorrido; animaciones con rig y transiciones
más orgánicas; cascadas animadas y efectos más ricos; iluminación medida en
hardware real. Los GLB definitivos deberán conservar escala, pivotes y clips
lógicos definidos en el catálogo.

Los nombres de mundo, protagonista y primer nivel siguen siendo de trabajo.
