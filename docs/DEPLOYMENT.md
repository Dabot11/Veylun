# Publicación en GitHub Pages

Destino: `https://dabot11.github.io/Veylun/`.

Primer despliegue confirmado por GitHub el 19 de octubre de 2026:
[Pages build and deployment #1](https://github.com/Dabot11/Veylun/actions/runs/39189859339),
resultado **Success**, revisión de publicación `716047d2c1ac3ffe2eee73dd6db2380e2d95a9c7`
y código fuente `48a8aa0425a689ac1345547019a6dc09f7c82a3a`.
GitHub habilitó Pages al recibir la rama; no fue necesario activarlo manualmente.

## Publicación vigente: salto y voltereta equipados

El 23 de octubre de 2026, fecha de America/Monterrey, se integró el
[PR #6](https://github.com/Dabot11/Veylun/pull/6) y se publicó la fuente
`b83b0f365e84555de195466c9d6f2c8aaad79dcf`. Su árbol coincide exactamente con
la revisión probada `a0384329a161faf414aba265c88ade1f37c1d975`. El commit de
`gh-pages` es `df6b2d858e945fdd893b0be42a0e1a01426f1a51`; su `deployment.json`
remoto confirma esa fuente y el build de `2026-10-23T06:50:54.272Z`.
[Actions 39914027016](https://github.com/Dabot11/Veylun/actions/runs/39914027016)
terminó con **Success**, actualizado a las `2026-10-23T06:51:49Z`. Build,
deploy, report-build-status y el paso Deploy to GitHub Pages aprobaron.

[Jugar](https://dabot11.github.io/Veylun/?v=b83b0f36) incorpora subida, caída,
aterrizaje y voltereta con **Shift**, conservando la espada y el escudo reducido
al 70% de su tamaño inicial. El [visor de movimiento](https://dabot11.github.io/Veylun/?inspect=ruen&motion=traversal-v1&v=b83b0f36)
permite revisar los cuatro clips propios. La física y la invulnerabilidad
mantienen sus reglas; daño y las demás acciones sin adaptar siguen usando
el rig provisional.

Aprobaron typecheck, build, **197 unitarias y 22 casos seleccionados de
navegador** (15 de desarrollo y siete de producción). Shift se repitió tras
corregir sólo un filtro de su test; la aplicación y el build permanecieron
intactos. Esta selección no repite la suite completa de 44 casos ni `journey`
y los encuentros restantes. [Evidencia](evidence/ruen-game-traversal/README.md).

La publicación se confirmó mediante Actions y el marcador remoto del commit;
el dominio público no se abrió en navegador por las restricciones de red.
Desarrollo y producción se probaron localmente.
[Verificación de despliegue](evidence/ruen-game-traversal/deployment-verification.json) ·
[Log de publicación](evidence/ruen-game-traversal/deploy.log).
Los cambios documentales posteriores no modifican el build publicado.

Para comparar sin modificar archivos ni guardado, usar `?ruen=provisional` y
retirar el parámetro para volver al modelo real. Para retirar esta etapa del
sitio, crear una reversión del **PR #6**, cuyo merge es `b83b0f365e84555de195466c9d6f2c8aaad79dcf`
y cuyo primer padre es `9c71a8e586a47cb1282ca85400d540ddff705c37`; revisar los
cambios y publicar el nuevo commit. Esa base conserva el combate anterior.

## Publicación anterior: guardia, bloqueo y combo equipado

El 22 de octubre de 2026, fecha de America/Monterrey, se integró el
[PR #5](https://github.com/Dabot11/Veylun/pull/5) y se publicó la fuente
`f828d84120b1df74a25ac51c62dbaf9666c9d866` desde `main`. Su árbol coincide
exactamente con la revisión probada `5db6021cb74a00042fb9b1c4b8c56f28a8bac702`.
`npm run deploy` terminó correctamente y generó el commit de `gh-pages`
`8c4216ae69400623c02c3b747f6cd4297c43a7cd`. El `deployment.json` remoto de ese
commit confirma la fuente y el build de `2026-10-23T05:27:26.757Z`.
[Actions 39905860479](https://github.com/Dabot11/Veylun/actions/runs/39905860479)
terminó con **Success**, incluidos build, deploy y el paso Deploy to GitHub Pages.

[Jugar](https://dabot11.github.io/Veylun/?v=f828d841) carga automáticamente a
Ruen con Idle, locomoción, guardia, reacción al bloqueo y los tres golpes del
combo. El escudo conserva su reducción del 30%. El
[visor de combate](https://dabot11.github.io/Veylun/?inspect=ruen&motion=combat-v1&v=f828d841)
abre Guardia en pausa y permite elegir cada animación. Salto, esquiva, daño y
las demás acciones aún sin adaptar conservan el rig provisional.

Typecheck, build, **173 unitarias en 17 archivos y 40 casos únicos de navegador**
aprobaron. El cierre tuvo tres tandas: siete nuevos, 32 regresiones y un caso
repetido tras corregir únicamente su texto esperado. La aplicación y el build
se conservaron durante ese ajuste. Los fallos iniciales y las correcciones
están en la [evidencia de combate](evidence/ruen-game-combat/README.md).

La publicación se confirmó mediante Actions y `deployment.json`. El dominio
público sigue restringido desde este entorno; las pruebas de desarrollo y
producción fueron locales. Los cambios documentales posteriores no modifican
este build, cuya fuente es `f828d841`.

## Publicación anterior: Idle y locomoción equipados

El 22 de octubre de 2026, fecha de America/Monterrey, se integró el
[PR #4](https://github.com/Dabot11/Veylun/pull/4) y se envió a Pages la fuente
`50210a9c445e8851fa28df178b986c4651ff9f76` desde `main`. Su árbol coincide
exactamente con la revisión probada `272339ed60a8abb4f7d6dd6b5583bc974f41b397`.
`npm run deploy` terminó correctamente y generó el commit de `gh-pages`
`907deb03d65c8ead5e3b07f68b50292c4e90fc86`.
El `deployment.json` de ese commit confirma la fuente y la fecha del build,
`2026-10-23T02:29:04.151Z`.
[Actions 39889821939](https://github.com/Dabot11/Veylun/actions/runs/39889821939)
terminó con **Success** para ese commit de `gh-pages` a las
`2026-10-23T02:29:45Z`.

Esta versión integra Idle, caminar y correr con espada y escudo en la
[ruta normal del juego](https://dabot11.github.io/Veylun/). El escudo usa el
70% de su tamaño anterior, tanto en gameplay como en el visor. El juego carga
copias optimizadas del equipo de 7.61 MB y 122,930 triángulos; los originales
permanecen intactos. Las demás acciones conservan el rig provisional.

Typecheck, build, **152 pruebas unitarias en 16 archivos y 33 de navegador**
aprobaron. La suite completa de navegador terminó en 28.7 minutos sin
omisiones ni reintentos. [Evidencia local](evidence/ruen-game-equipment/README.md).
La publicación se verificó mediante Actions y los metadatos del commit; el
dominio público sigue restringido desde este entorno. Desarrollo y producción
se probaron localmente. Los cambios documentales posteriores no modifican el
build publicado, cuya fuente es `50210a9c`.

## Publicación anterior: Idle con espada y escudo

El 22 de octubre de 2026 se integró el [PR #3](https://github.com/Dabot11/Veylun/pull/3)
y se publicó la fuente `15a6a6c52d224303e79a01e24255ee74b31cc2e4` desde `main`.
El árbol coincide exactamente con la revisión probada
`bba241905e99869e2234a718f9c6c10096cb332c`.
Commit de `gh-pages`: `844381b13cde0f13289091479ccb6bac913a4249`.
[Actions 39868086193](https://github.com/Dabot11/Veylun/actions/runs/39868086193)
terminó con **Success** para ese commit. `deployment.json` en `gh-pages`
confirma la fuente `15a6a6c`.

[Abrir el Idle equipado](https://dabot11.github.io/Veylun/?inspect=ruen&motion=idle-v1&equipment=azure)
carga Ruen, espada y escudo automáticamente, en pausa. Pulsa **Reproducir**;
desmarca **Espada y escudo (Idle)** para comparar con la versión neutra.
El equipo y la nueva pose permanecen exclusivamente en el visor.

Typecheck, build, 142 pruebas unitarias y 10 casos únicos de navegador
aprobaron; los casos de navegador se ejecutaron en dos lotes, sin reintentos.
[Evidencia y registros](evidence/ruen-equipment/README.md). La verificación
pública se hizo mediante Actions y los metadatos de publicación; el dominio
público está restringido desde este entorno. El build de producción se probó
en un servidor local. Los cambios documentales posteriores no modifican
el build publicado, cuya fuente es `15a6a6c`.

## Publicación anterior: prototipo de Idle propio

El 22 de octubre de 2026 se integró el PR #2 y se publicó la fuente
`43fa18c4c5711cc8d861bec05018490190b2f4c3` desde `main`. El árbol coincide
con la revisión probada `c65e8a4932a3cad54ab2e54b44ddc403721509cd`.
Commit de `gh-pages`: `41eed5cdd45c234990a0825ddcb54de12f4b4d25`.
[Actions 39853291990](https://github.com/Dabot11/Veylun/actions/runs/39853291990) y sus jobs build/deploy
terminaron con **Success**.

[Idle propio v1](https://dabot11.github.io/Veylun/?inspect=ruen&motion=idle-v1) abre el nuevo clip pausado;
pulsar **Reproducir**. Es un prototipo sólo del visor. El juego mantiene la
integración automática y el reposo estático de la revisión anterior. El master
conserva su hash y sus 20 clips originales. Los cambios documentales posteriores
no modificaron ese build, cuya fuente fue `43fa18c`.

Typecheck/build y 130 pruebas unitarias correctos; siete casos únicos del visor
aprobados (tres repetidos después de cerrarse el servidor local). Ver la
[evidencia](evidence/ruen-idle-v1/README.md). Publicación verificada mediante
Actions, sin acceso directo del navegador al dominio público desde este entorno.

## Publicación anterior: integración de Ruen / Meshy

El 22 de octubre de 2026 se integró el PR #1 en `main` y se publicó la fuente
`2045061ea5edffa5e93164ffe446b8034cf715dc`, cuyo árbol coincide exactamente
con la revisión validada `ad8665605291890093e2b2e33efed019f7430203`.
El commit de `gh-pages` es `99da774c01f0c797c25eb7a9361b4a0ecad0318c`.
[Pages build and deployment 39839671135](https://github.com/Dabot11/Veylun/actions/runs/39839671135)
finalizó con **Success**, incluido el job de despliegue.

[Jugar](https://dabot11.github.io/Veylun/) carga a Ruen automáticamente y lo
mantiene visible en reposo, caminando y corriendo. El
[visor](https://dabot11.github.io/Veylun/?inspect=ruen) también carga el master
sin pulsar un botón; la reproducción comienza pausada. `?ruen=meshy` sigue
siendo un alias; `?ruen=provisional` permite elegir el rig anterior sin
solicitar el GLB. El reposo es estático; las demás acciones conservan su rig
provisional hasta integrar las animaciones correspondientes.

La publicación se verificó mediante Actions. El sitio remoto no se comprobó
en navegador porque el entorno cloud restringe el acceso a su dominio. La
validación local pasó 123 pruebas unitarias, typecheck, build y 26 casos de
navegador, incluidos desarrollo y producción.

`main` contiene el código integrado. `gh-pages` contiene únicamente el build
estático, `.nojekyll` y `deployment.json` con la revisión de origen. Vite genera
rutas relativas compatibles con `/Veylun/`. Los cambios documentales
posteriores a esa revisión no modificaron su build, cuya fuente era `2045061`.
La publicación vigente se registra arriba.

### Publicación anterior

La prueba opt-in de Walking/Running se publicó desde `6a80022d1eb3988da303e5de4e48a35aaa80c9f4`
en `ab38a2c85c4e1ac2e2fedc806fc0eae17ec8ec5f`.
[Actions 39832580525](https://github.com/Dabot11/Veylun/actions/runs/39832580525)
finalizó con **Success**. Esa versión requería `?ruen=meshy` y conservaba el
rig provisional en reposo; fue reemplazada por la integración actual.

## Configuración de Pages

Ya está activa. Para reconstruir la configuración si se deshabilita:

En `https://github.com/Dabot11/Veylun/settings/pages`:

1. Source: **Deploy from a branch**.
2. Branch: **gh-pages**, carpeta **/ (root)**.
3. **Save**.

GitHub ejecuta su despliegue de Pages después de habilitar la publicación.
El repositorio debe permitir Pages para su visibilidad y plan actuales.
No se necesita un token adicional en el proyecto.

## Actualizaciones

Con Node 24, dependencias instaladas, acceso Git de escritura y cambios
guardados en un commit:

```sh
npm test
git push origin main
npm run deploy
```

El comando compila, crea un commit en la rama de publicación y lo sube sin
force push. Conserva el historial de `gh-pages` y no cambia la rama de trabajo.
Una actualización concurrente del remoto hace fallar el push; repetir el
comando recupera la revisión remota antes de publicar.

## Verificación

Revisar el despliegue de Pages en Actions y abrir la URL en Chrome. Verificar
menú, Nueva partida, escena, corazones y movimiento; comprobar ausencia de
errores 404 de JavaScript/texturas. `deployment.json` identifica el commit
fuente que está sirviendo el sitio.

La red del entorno cloud bloquea actualmente `api.github.com` y
`dabot11.github.io`. La publicación se confirmó mediante las herramientas conectadas de GitHub
y Actions, que muestran **Success** y la URL del sitio.
No se pudo abrir directamente el dominio público desde el entorno cloud.
