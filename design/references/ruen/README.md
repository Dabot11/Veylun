# Ruen — revisión de referencias

Recibidas en `1. Ruen.zip`: seis PNG de 1086 × 1448 píxeles. Se extrajeron
sin modificar los originales y se verificó su integridad. `inventory.json`
conserva nombres, dimensiones, tamaño y SHA-256; se omitieron únicamente los
metadatos AppleDouble de `__MACOSX`.

**Estado:** referencias conceptuales 2D revisadas. No contienen GLB, rig ni
clips de animación. Existe una representación procedural original revisada en
`src/assets/ruen.ts`; el modelo definitivo sigue pendiente.

## Vistas y uso

Los sufijos identifican los nombres originales registrados en el inventario.

| Sufijo | Vista o pose observada | Uso principal |
|---|---|---|
| `-1.png` | Frontal en tres cuartos, reposo armado | Volumen del cabello, rostro, capas de ropa y equipo |
| `-2.png` | Casi frontal, reposo armado | Referencia principal de proporciones y distribución de accesorios |
| `-3.png` | Carrera hacia la derecha, perfil en tres cuartos | Paso, inclinación, capa en movimiento y separación de armas |
| `-4.png` | Espalda en tres cuartos, rostro vuelto hacia la cámara | Capucha, caída de la capa, emblema dorsal y botas |
| `-5.png` | Ataque en zancada, espada cruzando el encuadre | Pose de ataque, giro de hombros y contrapeso del escudo |
| `-6.png` | Guardia frontal en tres cuartos, escudo adelantado | Silueta defensiva, escudo y lectura del rostro |

No hay vistas ortográficas exactas, una T/A-pose ni espalda completamente
despejada. No impide crear una versión provisional: las partes ocultas se
resolverán de forma coherente con las seis imágenes, sin afirmar que se hayan
observado. Las poses no equivalen a seis animaciones listas para reproducir.

## Rasgos constantes

- Rostro juvenil, mandíbula estrecha, ojos grandes marrón ámbar, cejas
  expresivas, nariz pequeña y orejas redondeadas visibles.
- Cabello rojo cobrizo brillante, voluminoso y despeinado, con mechones
  curvos separados, flequillo irregular y puntas que rompen la silueta.
- Hombros moderados, cuerpo compacto, manos y botas legibles. Mantener
  apariencia de joven explorador, sin alargarlo a proporciones adultas.
- Prenda superior verde muy oscuro, pantalón carbón, mangas cortas y piezas
  de cuero marrón: arnés cruzado, cinturón, bolsillos, brazales y botas altas
  con puños doblados, hebillas y correas.
- Capa con capucha marfil, motivos geométricos vegetales verde azulado,
  forro verde petróleo y bordes desgastados. Broche circular dorado con gema
  turquesa al cuello y segundo adorno romboidal en el pecho.
- Las imágenes muestran faldones de capa largos, aproximadamente hacia las
  rodillas, además de la pieza corta sobre los hombros. Conservar ambas
  lecturas al interpretar la «capa corta» descrita en el brief; prever su
  movimiento para que no oculte pies ni colisiones.
- Botas de cuero cálido con suela gruesa; guantes oscuros sin dedos, brazales
  y una rodillera con gema turquesa.
- Escudo apuntado con contorno dorado/bronce, paneles de madera oscura,
  líneas geométricas turquesa y gema romboidal prominente al centro.
- Espada de hoja clara facetada, guarda curva dorada, gema turquesa y pequeño
  colgante romboidal. Frasco turquesa sujeto al cinturón.

## Consistencia para el modelo

Hay variaciones de lateralidad del equipo entre las poses; no duplicar ni
cambiar armas de mano al animar. Convención técnica inicial: espada en mano
derecha y escudo en izquierda, compatible con la pose dinámica de ataque.
Esto es una normalización de producción, no un detalle idéntico en las seis
referencias. Usar `-2` para proporciones, `-4` para capa/espalda y `-5`/`-6`
para lectura de ataque y defensa.

Altura inicial del brief: **1.45 m**. Proporción visual orientativa: unas
5.5–6 cabezas incluyendo cabello, a comprobar en el blockout. No hay escala
física en los PNG que permita medir metros.

Paleta inicial estimada visualmente (sin muestreo calibrado):

| Uso | Color orientativo |
|---|---|
| Cabello / sombra | `#c94d1d` / `#792d17` |
| Capa marfil | `#e6d7b9` |
| Forro verde petróleo | `#245a55` |
| Ropa verde oscura / pantalón | `#273934` / `#302f2c` |
| Cuero | `#80502e` |
| Herrajes cálidos | `#ba883f` |
| Gemas y ornamentos | `#30c9cd` |

## Construcción y animación previstas

1. Blockout articulado de cabeza, tronco, pelvis, brazos y piernas; comparar
   silueta frontal, lateral y posterior antes del detalle.
2. Mallas originales de mechones curvos, capa con capucha, botas, brazales y
   equipo. Mantener grandes masas y motivos reconocibles a distancia de cámara.
3. Separar espada, escudo, capa y colgantes. Pivotes en hombros, codos,
   muñecas, cadera, rodillas, tobillos y cuello; origen de personaje en suelo.
4. Representación provisional animada mediante jerarquía de nodos o rig.
   Quince estados del brief: idle, caminar, correr, saltar, caer, aterrizar,
   rodar, tres ataques, escudo, daño, muerte, interacción y victoria.
5. Materiales reutilizados para tela, piel, cabello, cuero, metal y gemas.
   Emisión turquesa moderada; evitar convertir toda la ropa en metal brillante.
6. Validar en Babylon.js escala, orientación, poses, colisiones visuales de
   capa/armas y liberación de recursos. Reemplazar después por GLB definitivo
   mediante el catálogo existente, sin modificar las reglas jugables.

La calidad y el detalle de las ilustraciones son una referencia de dirección;
no se afirma una conversión automática a un modelo 3D equivalente.
