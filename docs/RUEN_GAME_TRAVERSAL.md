# Salto y voltereta de Ruen

Estado: **validado y publicado desde `b83b0f36`, con 197 unitarias y 22 casos seleccionados de navegador**.
Esta etapa adapta subida, caída, aterrizaje y voltereta al Ruen real con espada
y escudo. Amplía la versión anterior `f828d841`, con Idle, locomoción y combate
equipados; sus 173 unitarias y 40 casos de navegador permanecen como resultados
de aquella etapa.

## Movimiento y animación

`createRuenEquippedTraversal` crea `Ruen_Jump_Equipped`, `Ruen_Fall_Equipped`,
`Ruen_Land_Equipped` y `Ruen_Roll_Equipped` sobre el esqueleto existente. Cada
grupo cubre 160 canales a 60 fps. Mantienen a Ruen con su equipo al saltar y
al hacer la voltereta con **Shift**, respetando las reglas de `Simulation`:

| Acción | Dato que guía la pose | Regla que se conserva |
| --- | --- | --- |
| Subida del salto | Velocidad vertical del jugador | El controlador decide impulso, altura y gravedad. |
| Caída | Velocidad vertical, sin depender de reiniciar `stateTime` | La transición desde subida no añade otro desplazamiento. |
| Aterrizaje | Tiempo del estado | Duración de 0.12 s. |
| Voltereta | Tiempo y dirección `rollX`/`rollZ` | Duración de 0.45 s e invulnerabilidad de 0.25 s. |

La subida se calibra con la duración derivada de gravedad y altura del salto
actual, aproximadamente 0.380058 s; el clip de caída tiene una referencia de
0.3 s. En gameplay ambos se muestrean con la velocidad vertical, sin usar
`stateTime` ni fijar el tiempo real en el aire.

La voltereta gira 360° dentro de la pelvis y sigue `rollX`/`rollZ`, también
con un objetivo fijado. Conserva la posición y orientación exterior del
controlador. Aterrizaje y voltereta siguen su tiempo de estado incluso si el
jugador deja de estar apoyado. La animación se pausa con la simulación y
tiene prioridad sobre la guardia durante el vuelo. Las pruebas revisan
colisiones, salto desde controles, caída sin impulso desde una altura
preparada y regreso a Idle/locomoción.

## Modelos y visor

Los cinco GLB coinciden por SHA-256 con la fuente publicada `f828d841`;
[verificación](evidence/ruen-game-traversal/asset-hashes.json). Los 20 clips
originales del master permanecen intactos.
Las animaciones nuevas se crean en memoria. El escudo mantiene escala 0.294,
el 70% del montaje inicial, y la espada mantiene 0.55.

Abre [el juego publicado](https://dabot11.github.io/Veylun/?v=b83b0f36) o el
[visor de movimiento](https://dabot11.github.io/Veylun/?inspect=ruen&motion=traversal-v1&v=b83b0f36).
La ruta local es `?inspect=ruen&motion=traversal-v1`. Incluye el master
y las copias del equipo que usa el juego. Permite revisar **Salto · subida**,
**Caída**, **Aterrizaje** y **Voltereta**, además de los clips propios anteriores.
El visor repite las poses en el sitio; no simula la altura del salto ni aplica
invulnerabilidad. `motion=combat-v1` conserva su selección de combate.

El conjunto suma 12 clips propios: tres de locomoción, cinco de
combate y cuatro de movimiento. Con los originales son 32 grupos en gameplay;
el visor de movimiento añade el Idle neutro y muestra 33. Estos grupos no se
incorporan al archivo master.

Para comparar de forma reversible, abre `/?ruen=provisional`: carga el rig
anterior sin solicitar los GLB reales. Quita el parámetro para volver a Ruen
equipado. Esta opción no cambia archivos ni el guardado. La reversión del
PR #6 y la base anterior se detallan en el [registro de despliegue](DEPLOYMENT.md).

## Validación y límites

Daño, muerte, interacción y los desplazamientos laterales/hacia atrás con
objetivo fijado fuera de guardia conservan sus variantes provisionales. Se
mantiene el fallback para modelos o equipo no disponibles, o si falla la
creación de estos clips. Equipo parcial/error conserva la locomoción real
sin armas y usa el rig provisional para salto y voltereta.

Aprobaron **197 pruebas unitarias en 18 archivos** en 4.56 s, typecheck y build.
La auditoría manual de malla completa corrigió el apoyo de pies y capa;
los mínimos finales de aterrizaje y voltereta quedan dentro de la tolerancia
de contacto de 0.01 unidades. Esta calibración no sustituye jugar desde controles.

Una comprobación de entrada a la voltereta detectó penetración transitoria
al mezclar piernas y pelvis; se corrigió para mezclar sólo la parte superior.
La comprobación final aprobó las 130 muestras, dentro de la tolerancia de
contacto. Aprobaron **22 casos únicos de navegador: 15 de desarrollo y siete
de producción**. El cierre comprende cuatro casos nuevos y 18 regresiones;
Shift se repitió después de corregir sólo un filtro de su test, conservando
la aplicación y el build.

Es una selección de la suite de 44 casos: no repite `journey` ni los encuentros
de enemigos restantes. La caída se prueba sin impulso desde una altura
preparada. [Actions 39914027016](https://github.com/Dabot11/Veylun/actions/runs/39914027016)
confirmó la publicación de `b83b0f36`.
[Evidencia actual](evidence/ruen-game-traversal/README.md).
