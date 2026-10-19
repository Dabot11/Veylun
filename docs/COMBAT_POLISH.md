# Pulido del encuentro de los Brotes — 18 de octubre de 2026

El primer combate ahora comunica el daño, la dirección de la embestida y
el momento de responder. El progreso guardado sigue usando el esquema v1.

## Comportamiento

- Panel con nombre, vida numérica y barra, objetivo fijado y estado del enemigo.
  Prioriza el objetivo fijado, después un impacto reciente y después el enemigo
  cercano visible. Muestra brevemente «Purificado» al derrotarlo.
- Confirmación de impacto con daño efectivo; el tercer golpe tiene sonido y
  partículas más intensos. El cuerpo reacciona y destella durante el impacto.
  Los materiales compartidos con el bosque no se modifican.
- Flecha ámbar durante la preparación de la embestida. Ambos Brotes pueden
  perseguir, pero solo uno prepara o ejecuta una embestida a la vez. Hay 350 ms
  de separación; cada uno mantiene su propia recuperación.
- Bloquear de frente detiene la carga y abre una ventana para contraatacar.
  Los impactos pausan brevemente a enemigos ordinarios sin reiniciar su ataque.
  El Guardián no recibe esa pausa.
- Fijación por dirección de cámara y visibilidad. Cambio izquierda/derecha
  consistente; liberación tras una obstrucción persistente. La cámara permite
  órbita manual antes de volver al objetivo y amplía el encuadre a distancia.
- Encuadre ligeramente elevado y desplazado al fijar, con menor desplazamiento
  en pantallas estrechas para mantener a Ruen dentro de la imagen.
- Corrección de entrada al iniciar o reanudar: una tecla pulsada antes del
  siguiente frame ya se admite según el menú actual.
- Ayuda contextual para teclado o mando durante el primer combate. Los avisos
  de zona se ocultan mientras el panel de combate está presente.

## Comprobaciones

`combatPolish.test.ts` cubre alternancia de ambos Brotes, bloqueo y respuesta,
pausa acotada al recibir daño, daño efectivo, selección por cámara, cambio de
objetivo, obstrucciones y prioridad/caducidad del panel. `camera.test.ts` verifica
órbita manual, recentrado y proyección de ambos personajes dentro del encuadre.
Se comprueba tanto el formato horizontal como una ventana de 390 × 844.

Las pruebas de navegador verifican vida y confirmación de daño desde teclado,
ratón y mando simulado. Un escenario adicional acerca a Ruen a un Brote con IA
activa y usa Q, K y J para fijar, bloquear y contraatacar sin perder salud.
Después comprueba que volver al checkpoint limpia los avisos de combate.
La prueba de controles y altar reproduce además una tecla recibida en el
mismo turno del evento de inicio, antes de que llegue el siguiente frame.

El recorrido completo de lógica sigue usando comandos de movimiento, combate
e interacción sin conceder objetos, daño ni salud. Los resultados ejecutados y
los límites de la validación están en `VALIDATION.md`.
