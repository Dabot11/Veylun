# Ruen / Meshy: primera prueba aislada

Estado al 22 de octubre de 2026: **visor implementado; validación del master e
integración al gameplay pendientes**. Rama: `feat/ruen-meshy-inspector`.
Base sin cambios de esta tarea: `1928f65` en la rama `work`.

## Acceso al archivo y alcance comprobable

El adjunto `Meshy_AI_Crimson_Gemwarden_All_Animations.glb` no pudo descargarse:
el transferidor devolvió `file exceeds the executor transfer limit of 32 MiB`.
No se encontró un GLB/GLTF del protagonista en el repositorio ni en el archivo
MVP disponible. No se ha importado, inspeccionado visualmente ni modificado
el master. Las medidas de la siguiente sección proceden del encargo y no son
resultados de esta ejecución.

Se añadió una escena separada y reversible. La entrada normal del MVP sigue
creando la misma `Application`; `?inspect=ruen` carga únicamente el visor.
La simulación, controles Xbox/teclado, colisiones, cámara de seguimiento,
salto, combate, checkpoints y guardado no se modificaron. El modo inspector
no crea `Simulation`, `InputManager` ni `SaveStore`.

## Abrir el modo de prueba

```sh
cd /workspace/Veylun
npm run dev
```

Abre la dirección de Vite agregando `?inspect=ruen` (habitualmente
`http://localhost:5173/?inspect=ruen`). También funciona en el build de
producción con `npm run preview` y el mismo parámetro.

Opciones para cargar el archivo real:

1. **Abrir GLB desde tu equipo**: selecciona el master. Se lee como `File` en
   el navegador; no hay carga a un servidor ni escritura sobre el original.
2. Copia el master intacto a
   `public/assets/models/ruen/Meshy_AI_Crimson_Gemwarden_All_Animations.glb`
   y pulsa **Cargar desde el repositorio**. La ruta respeta `BASE_URL`.

No se intenta descargar un archivo ausente al entrar en el visor. Un fallo
muestra el error y permite reintentar. No se crea un sustituto de Ruen.

El archivo se carga pausado con Walking seleccionado si existe. El selector
usa exclusivamente los nombres de `animationGroups` que devuelve Babylon;
cambiarlo reproduce un único grupo. Hay reproducir/pausar, reinicio,
velocidad 0.1–2×, vistas frontal/lateral/trasera y órbita/zoom con el ratón.
La reproducción se pausa al ocultar la pestaña. Las vistas usan +Z como
frente de referencia, hasta confirmar la orientación del asset real.

El inventario exportable recoge nombres reales de grupos, duración leída de
sus frames/FPS, skeletons y bones, mallas, materiales, texturas y dimensiones.
Las extensiones se leen de `extensionsUsed`/`extensionsRequired` del JSON;
se identifican como declaraciones del archivo, no como extensiones cuya
ejecución haya sido comprobada.

## Carga y jerarquía

El cargador aislado utiliza `LoadAssetContainerAsync` de Babylon.js 9.31.0
con `pluginOptions.gltf.animationStartMode = GLTFLoaderAnimationStartMode.NONE`.
Detiene defensivamente los grupos importados. Antes de cambiar de clip,
restaura los canales del anterior y lo detiene; no inicia todos los grupos.

Se conserva el nodo de conversión glTF, todos los roots importados, los
transform nodes, joints, skins y materiales. Un nuevo contenedor exterior
recibe escala uniforme y orientación opcionales. No se normalizan huesos,
se reescribe geometría ni se edita la malla skinned. El visor usa iluminación
neutra local con una reflexión PBR generada en memoria, sin entorno remoto.

## Datos del encargo, pendientes de confirmar

- 43,216,948 bytes; 51,727 triángulos; 70,995 vértices exportados.
- Una malla/material; skin SmartRigArmature de 80 joints, principalmente
  `mixamorig:`; cuatro influencias por vértice; altura de pose base 1.70 unidades.
- Color 2K, normal 2K, metallic-roughness 4K; 23.91 MB de texturas y datos
  no referenciados adicionales en el master.
- 20 clips esperados: Running, Walking, Archery_Shot, Arise, Attack,
  Axe_Breathe_and_Look_Around, Axe_Spin_Attack, Back_Jump, BeHit_FlyUp,
  Climb_Attempt_and_Fall_1, Climb_Attempt_and_Fall_5,
  Climb_Left_with_Both_Limbs, Collect_Object, Combat_Stance, RunFast,
  Sneaky_Walk, Weapon_Combo, Weapon_Combo_1, Weapon_Combo_2, dying_backwards.

**Clips de Meshy verificados en este visor: ninguno. Clips de Meshy conectados
al gameplay: ninguno.** Las pruebas sintéticas usan nombres Walking y Running
para ejercitar el selector; no contienen las animaciones ni el arte de Meshy.

No hay Idle neutro, Block, Roll/Dodge ni salto normal identificados según la
inspección aportada. `Combat_Stance` y `Axe_Breathe_and_Look_Around` no se
asignan como idle/bloqueo. Mientras falta la validación, el juego utiliza
explícitamente su rig y sus animaciones provisionales existentes.

## Validación que desbloquea la integración

1. Abrir el master; registrar tamaño y SHA-256 sin alterarlo. Exportar el
   inventario real y confirmar malla, texturas, skin, 80 joints y 20 clips.
2. Reproducir **Walking** (1.033 s esperados) y **Running** (0.633 s esperados)
   por separado. Revisar manos, hombros, rodillas, capa desde atrás, frente,
   suelo/contacto de pies y ciclos. Registrar capturas frontal/lateral/trasera
   y consola; confirmar traslación neta de pelvis prácticamente cero.
3. Sólo tras esa validación, añadir un adaptador visual propio para locomoción,
   separado del collider y del root del rig provisional. El root actual también
   se inclina durante esquiva/daño: no sirve como ancla neutra del GLB.
4. Actualizar posición/yaw exteriores desde el controlador. La cámara continúa
   siguiendo `sim.player`, nunca la pelvis. Escalar uniformemente en otro
   contenedor exterior; no fijar una corrección de frente sin verla.
5. Obtener velocidad real del desplazamiento horizontal entre muestras,
   dividido por el avance de `sim.age`. `player.vx/vz` conservan velocidad
   deseada al chocar y no bastan. Reiniciar la muestra tras respawn/teleport o
   nueva simulación. `speedRatio = velocidadReal / velocidadReferencia` es
   adimensional: no volver a multiplicar por delta time.
6. Mezclar únicamente Walking/Running con pesos complementarios. Mantener el
   rig actual como fallback explícito para estados no validados, sin cambiar
   ventanas de impacto, daño, defensa o física. Registrar las mallas cargadas
   en las sombras del juego y liberar recursos al destruir la escena.
7. Validar transición caminar/correr, pared sin avanzar, reposo, salto,
   aterrizaje, esquiva, tres golpes, defensa, daño, muerte y checkpoint. El
   fallo de carga debe dejar visible el fallback actual.

Attack dura 2.8 s según el encargo; Weapon_Combo, Weapon_Combo_1 y
Weapon_Combo_2 duran 3.667/3.5/4.5 s. Son secuencias completas, no los tres
golpes del combo. Revisar coreografía y ventanas de impacto antes de
conectarlas. Reproducir un clip no genera daño.

Los tres Weapon_Combo desplazan Z 1.23/2.08/0.99 unidades y Back_Jump retrocede
1.99 unidades según el encargo. El visor conserva el movimiento original sin
collider; aún no se ha observado en el master real. Para futuras pruebas de combate se necesita gestionar root motion
deliberadamente o crear una copia in-place, conservando vertical y rotación
necesarias. No añadir mecánicas de arco, hacha o escalada, parry o cargados.
Espada y escudo separados se vincularán más adelante a `mixamorig:RightHand`
y `mixamorig:LeftHand`, con offsets ajustados después de revisar animaciones.

## Pruebas realizadas y pendientes

- `npm run typecheck`: aprobado.
- `npm test`: 110 pruebas aprobadas, incluidas cuatro nuevas pruebas del
  cargador/reproductor (NONE, jerarquía/skin, exclusividad/restauración,
  pausa/velocidad y descarte de carga tardía).
- `npm run build`: aprobado; advertencia de tamaño de chunk glTF >500 kB.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- --workers=1`:
  **20 pruebas aprobadas** en Chromium con renderizador software. Tres casos
  nuevos usan el GLB sintético para comprobar carga local y por URL en el
  build, selector, pausa inicial, un clip activo, velocidad, vistas, reintento,
  orientación, consola y ausencia de cambios al guardado. Los otros 17 cubren
  controles, combate, checkpoints y el recorrido hasta restaurar el altar.
  El recorrido completo incluye muerte deliberada y recarga del guardado.
- GLB real, materiales de Meshy, Walking/Running reales, articulaciones,
  capa, orientación y pies: pendientes por falta de acceso al master.
- Xbox físico y FPS/rendimiento en el Mac de David: no probados.

El fixture `tests/fixtures/inspection-glb.ts` es un panel skinned de dos
joints con dos clips sintéticos y un material coral. Es evidencia del flujo
de carga y UI, no del protagonista. Las capturas de prueba se guardan en
`test-results/` y deben identificarse como sintéticas.

La primera ejecución detectó una carrera en una prueba existente: la
simulación y la UI reinician antes de que `SanctuaryView` actualice niebla y
luces en el siguiente render. Se cambió únicamente esa aserción a
`expect.poll`, conservando todos los valores esperados. Otra prueba fue
interrumpida por recarga de Vite durante una edición; la ejecución completa
posterior, sin ediciones concurrentes, pasó los 20 casos.

Captura y logs conservados fuera de la carpeta temporal de Playwright:

- `/workspace/veylun-validation/ruen-meshy-inspector/visor-fixture-sintetico.png`
- `/workspace/veylun-validation/ruen-meshy-inspector/browser-tests.log`
- `/workspace/veylun-validation/ruen-meshy-inspector/build.log`

El log de navegador incluye el error esperado al cargar deliberadamente
`invalid.glb`: `RangeError: Invalid typed array length: 20`. Los casos de
carga válida sintética verificaron consola y excepciones sin errores.

## Optimizar una copia de distribución después

Conservar el master y su hash. Crear una copia con nombre distinto, inventariar
buffers/accessors/texturas y eliminar únicamente datos no referenciados con
una herramienta glTF; validar la copia y comparar clips, skeleton y apariencia.
Medir tamaño, tiempo de carga y memoria de texturas en el equipo objetivo.
Evaluar compresión KTX2/Basis de texturas y resolución metallic-roughness en
esa copia, comprobando soporte de Babylon y comparación visual. No reducir
geometría en esta tarea ni aprobar una optimización sólo por los bytes.

## Reversión

Para volver al juego, usa **Volver al MVP** o elimina `?inspect=ruen`; no hay
migraciones de guardado. Para recuperar el código previo, cambia a la rama
`work` después de conservar los cambios locales. El cambio queda aislado en
`feat/ruen-meshy-inspector`; también se puede revertir su commit. No se ha
publicado ni modificado el sitio de GitHub Pages.
