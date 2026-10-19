# Veylun: El Santuario Olvidado

MVP de aventura 3D original para navegador, con un nivel de cinco zonas,
combate de espada/escudo, tres enemigos, acertijo, dos checkpoints y victoria
al restaurar el altar. Babylon.js + TypeScript estricto + Vite, sin backend.
Veylun, Ruen y el título del nivel son nombres de trabajo.

## Iniciar en Chrome

Node.js 24 LTS y npm:

```sh
npm install
npm run dev
```

Abre en Chrome la dirección que imprime Vite. Pulsa **Nueva partida**.
Activa la aceleración gráfica del navegador. Un clic en la escena captura el
ratón; si no está disponible, arrastra para girar la cámara. Escape pausa.

```sh
npm test
npm run build
npm run preview
```

El build comprueba TypeScript y genera `dist/` con rutas relativas. Se puede
servir en GitHub Pages o cualquier hosting estático. La publicación en la rama
`gh-pages` se realiza con `npm run deploy`; consulta `docs/DEPLOYMENT.md` para
la activación inicial y la verificación del sitio.
No se necesitan secretos, cuentas, CDN ni servicios durante el juego.

En el entorno cloud, usa `npm ci --cache /workspace/.cache/npm` para respetar
los permisos de escritura. Ver `docs/CLOUD_SETUP.md`.

## Recorrido

1. Explora el Claro del despertar y sigue la luz turquesa hacia el sendero.
2. Derrota a los dos Brotes corruptos. Se libera el paso y se activa checkpoint 1.
3. Derrota al Espíritu, activa el interruptor y entra por la reja al cofre.
4. Recoge la llave y abre la puerta del santuario con interacción. Checkpoint 2.
5. Vence al Guardián y **activa el altar**. Derrotar al jefe por sí solo no gana.

El brillo turquesa que acompaña a Ruen señala el objetivo siguiente. Los aros
ámbar anuncian ataques. El Guardián alterna golpe frontal (bloqueable) y golpe
al suelo (esquivar, alejarse o saltar). Aprovecha su recuperación para atacar.

## Controles

| Acción | Teclado / ratón | Xbox estándar |
|---|---|---|
| Moverse | WASD | Stick izquierdo |
| Cámara | Ratón / arrastrar | Stick derecho |
| Saltar | Espacio | A |
| Rodar | Shift | B |
| Espada | Clic izquierdo / J | X |
| Interactuar | E | Y |
| Escudo | Clic derecho / K | LT |
| Fijar / soltar objetivo | Q | RT |
| Cambiar objetivo | Tab | LB / RB |
| Pausa | Escape | Menu |

Encadena hasta tres golpes pulsando de nuevo durante el ataque. El tercero
hace más daño. Escudo de frente, invulnerabilidad breve al rodar y después de
recibir daño. No hay parry, ataques cargados ni doble salto.

Para Xbox en macOS: empareja el mando en Ajustes del Sistema → Bluetooth,
abre Chrome y pulsa un botón. Stick vertical o cruceta navega los menús;
A selecciona, B vuelve. En Controles → Diagnóstico del mando se muestran
mapping, ejes y botones. Los mandos de mapping no estándar se diagnostican
pero requieren teclado/ratón; no se adivinan asignaciones.

## Guardado

`localStorage`, clave `veylun.save.v1`, esquema validado. Se guarda después
de eventos importantes y periódicamente durante la partida. Continuar aparece
si hay datos válidos. Si el almacenamiento falla, se avisa y se sigue en memoria.
La pausa permite volver al checkpoint y reiniciar con confirmación.

Al morir se conservan llave, cofre, interruptor, reja, puerta y enemigos
ordinarios derrotados. Ruen recupera diez unidades de salud; la pelea del
Guardián se reinicia. Los checkpoints recuperan salud y los enemigos ordinarios
derrotados recuperan una unidad como ayuda de balance.

## Arte y estado real

Se revisaron **24 referencias PNG de personajes**, seis por cada uno, más la
imagen del santuario visible en el chat. Los originales están separados en
`design/references/` y no se descargan con el juego.

Los cuatro modelos son **3D procedurales provisionales**, con partes articuladas,
materiales/texturas originales y animación por código. Conservan las siluetas,
paletas y rasgos principales; simplifican notablemente el detalle de las
ilustraciones. No hay modelos GLB definitivos ni una conversión automática de
imágenes. `VisualOverrides` carga GLB y sus clips cuando se configura una ruta
real en `assetCatalog.ts`, sin cambiar la simulación.

## Pruebas

Pruebas de lógica: `npm test`. Incluyen un recorrido completo con comandos de
movimiento, ataques e interacción, sin conceder daño ni objetos en esa prueba.
Las pruebas aisladas sí crean estados concretos para verificar cada regla.

Pruebas de navegador: cuatro sobre el build y una de controles/altar en
desarrollo con un estado avanzado preparado:

```sh
npm run build
npx playwright install chromium
npm run test:e2e
```

Si Chromium ya está instalado:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Se usa un Xbox **simulado** para probar la Gamepad API; no se probó hardware
físico. La lista de verificaciones y resultados está en `docs/VALIDATION.md`.

## Próxima iteración

Refinar modelos/animación, distribución del bosque y calidad de texturas;
medir rendimiento en Chrome/macOS real; probar Xbox físico; ajustar dificultad
y duración con jugadores. El objetivo de 10–15 minutos y 60 FPS aún requiere
validación en hardware real. El MVP es más compacto para un jugador que ya
conoce el recorrido. No hay música de fondo: los efectos son síntesis original.

Documentación: `GAME_DESIGN.md`, `ART_DIRECTION.md`, `ASSET_MANIFEST.md`,
`ARCHITECTURE.md` y `docs/ACCEPTANCE.md`.
