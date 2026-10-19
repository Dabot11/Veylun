# Cámara de juego

`FollowCamera.ts`: seguimiento suave, órbita, zoom 3–8 m, límites verticales,
encuadre de objetivo fijado, barrido con margen contra colliders del nivel y
recuperación progresiva de distancia. Se restablece después de reaparecer.
Los ajustes de distancia, sensibilidad e inversión están en pausa.
Con objetivo lejano, el encuadre puede ampliar distancia hasta 10,5 m.
Mover la cámara suspende el recentrado durante 650 ms; después vuelve suavemente.
La simulación recibe su orientación para elegir el objetivo visible al frente.
