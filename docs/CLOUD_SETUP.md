# Entorno cloud de Veylun

Trabajar en `/workspace/Veylun`, checkout ya aislado. No crear worktrees salvo
petición explícita. El repositorio incluye ahora el MVP y las 24 referencias
originales fuera de los assets de runtime.

## Instalación y validación

Node 24 y npm están disponibles. El directorio personal no es escribible:

```sh
cd /workspace/Veylun
npm ci --cache /workspace/.cache/npm
npm test
npm run build
```

## Arranque

```sh
cd /workspace/Veylun
npm run dev -- --host 127.0.0.1
```

Puerto 5173. Verificar HTTP 200 y una prueba en navegador: menú inicial,
Nueva partida, bosque renderizado, corazones y movimiento con WASD. El
estado de carga debe desaparecer. No basta verificar un PID o puerto.

Para comprobar el build estático, `npm run test:e2e` inicia preview en 4173.
También inicia desarrollo en 5174 para el escenario instrumentado del jefe
y el altar. Ejecutar `npm run build` antes de las pruebas:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

No requiere backend, secretos ni variables de aplicación. Los efectos de
sonido se habilitan al interactuar. Los datos de partida están en localStorage
del navegador, no en un servidor.

Los archivos y dependencias se pueden conservar en el snapshot; los procesos
no sobreviven a nuevas instancias y deben iniciarse de nuevo. No publicar
enlaces de loopback como previews desde la interfaz de onboarding.
Guardar `install_script`/`start_skill` es distinto de publicar el entorno.
La publicación y la restauración en otra tarea no se afirman comprobadas aquí.
