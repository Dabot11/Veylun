# Audio

`AudioManager.ts` sintetiza efectos originales con Web Audio después de un
gesto del usuario. Incluye pasos, espada, impactos, escudo, rodada, proyectiles,
cofre, interruptor, puerta, checkpoint, derrota, restauración y victoria.
Espada: ruido filtrado corto. Impacto: ruido y tono grave descendente, más
intenso en el tercer golpe. Bloqueo: dos tonos metálicos; muerte enemiga: campanada.
El volumen se ajusta en pausa. El buffer de ruido se reutiliza y las fuentes,
filtros y ganancias se desconectan al terminar.
El Espíritu tiene una señal ascendente durante la carga, un disparo distinto
del impacto de espada y un efecto breve cuando la magia choca contra cobertura.
No hay música de fondo ni archivos de audio externos.

## Guardián y cierre

El golpe frontal prepara un tono más alto; el golpe al suelo usa un ascenso grave
doble. El impacto se emite al resolver el daño, con una ráfaga más grave para el
suelo. La derrota tiene cuatro notas espaciadas; la restauración acompaña los tres
segundos de ceremonia. Se conservan volumen configurable y desconexión de nodos.
