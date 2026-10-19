# Primera revisión artística: Ruen y Claro del despertar

19 de octubre de 2026. Basada en las seis referencias de Ruen y en la imagen
del santuario entregadas por el usuario. Los PNG originales se conservan.

## Ruen

- Silueta de cabello con mechones curvos y afinados; rostro con mandíbula,
  boca, iris ámbar y flequillo separado de los ojos.
- Capa marfil continua con forro petróleo y emblema dorsal, capucha plegada,
  arnés cruzado, bordes de túnica, frasco, bolsillos, brazales y rodillera.
- Gemas romboidales, metal sin emisión, espada con nervadura, guarda curva y
  colgante. Inclinación de reposo que mantiene la punta fuera del suelo.
- Codos y rodillas articulados; carrera vinculada a velocidad, flexión de
  salto/aterrizaje, rodada recogida y guardia con el escudo delante del torso.

La jerarquía de armas sigue la mano correspondiente. Los tiempos, áreas de
daño, orientaciones jugables y controles no cambian. Los tests de ataque
comprueban el extremo real de la hoja durante los tres golpes en cuatro
orientaciones del personaje.

## Claro

Dos anillos de losas siguen la altura del terreno. El centro tiene grabados y
un símbolo del santuario. El sendero sale entre helechos divididos y grupos de
flores azul marfil. Hiedra y musgo usan los pilares y el primer arco existentes.
Las copas cercanas y el arco proyectan sombras si la opción está activada.

La decoración nueva es estática y se fusiona por material y atributos de
vértices. Las pequeñas hojas de los helechos se construyen en dos lotes de
geometría, evitando miles de mallas temporales. Solo un subconjunto local
del dosel se añade al mapa de sombras.
No se introducen obstáculos nuevos, cambios de guardado ni recursos remotos.

## Comprobaciones

Consultar `VALIDATION.md` para los resultados de esta revisión. Las capturas de
poses usan estados preparados y cámara de inspección; las comprobaciones de
daño y controles usan entradas reales del navegador en encuentros preparados.

Sigue siendo arte procedural provisional. No equivale al detalle de las
ilustraciones ni a un personaje con esqueleto, skinning y animaciones finales.
Falta validar rendimiento y movimiento percibido en una GPU y mando físicos.
