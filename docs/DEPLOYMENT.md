# Publicación en GitHub Pages

Destino: `https://dabot11.github.io/Veylun/`.

Primer despliegue confirmado por GitHub el 19 de octubre de 2026:
[Pages build and deployment #1](https://github.com/Dabot11/Veylun/actions/runs/39189859339),
resultado **Success**, revisión de publicación `716047d2c1ac3ffe2eee73dd6db2380e2d95a9c7`
y código fuente `48a8aa0425a689ac1345547019a6dc09f7c82a3a`.
GitHub habilitó Pages al recibir la rama; no fue necesario activarlo manualmente.

## Publicación vigente: prototipo de Idle propio

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
no modifican el build publicado, cuya fuente es `43fa18c`.

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
La publicación vigente del prototipo se registra arriba.

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
