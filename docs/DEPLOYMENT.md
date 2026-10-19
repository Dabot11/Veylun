# Publicación en GitHub Pages

Destino: `https://dabot11.github.io/Veylun/`.

`main` contiene el código y las referencias. `gh-pages` contiene únicamente
el build estático, `.nojekyll` y `deployment.json` con la revisión de origen.
Vite genera rutas relativas compatibles con `/Veylun/`.

## Activación inicial

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
`dabot11.github.io`. Esto impide activar Pages por API y confirmar la URL
pública desde este entorno; subir la rama por Git no prueba que el sitio
ya esté activo.
