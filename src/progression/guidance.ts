import { distance, type V2 } from '../core/math';
import type { Simulation } from '../core/Simulation';
import type { SaveDataV1 } from './types';
import { firstSolidHit, groundHeight } from '../world/level';

// Corners and entrance of the chest enclosure. Routes are checked against the
// actual colliders with clearance for Ruen, including pillars beside the grate.
const ruinsCorners: V2[] = [
  { x: 5.7, z: 55.7 }, { x: 10, z: 55.7 }, { x: 14, z: 55.7 },
  { x: 5.7, z: 66.2 }, { x: 14, z: 66.2 },
];
export function ruinsWaypoint(from: V2, goal: V2, save: SaveDataV1): V2 {
  const open = (a: V2, b: V2): boolean => firstSolidHit(
    { ...a, y: groundHeight(a.x, a.z) + .5 },
    { ...b, y: groundHeight(b.x, b.z) + .5 }, save, .36) === undefined;
  if (open(from, goal)) return goal;
  const nodes = [from, ...ruinsCorners, goal], last = nodes.length - 1;
  const costs = nodes.map(() => Infinity), previous = nodes.map(() => -1), visited = new Set<number>();
  costs[0] = 0;
  for (let count = 0; count < nodes.length; count++) {
    let current = -1;
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (current < 0 || costs[i]! < costs[current]!)) current = i;
    if (current < 0 || !Number.isFinite(costs[current]!)) break;
    if (current === last) {
      let next = last;
      while (previous[next]! > 0) next = previous[next]!;
      return nodes[next]!;
    }
    visited.add(current);
    for (let i = 1; i < nodes.length; i++) {
      if (visited.has(i)) continue;
      const cost = costs[current]! + distance(nodes[current]!, nodes[i]!);
      if (cost < costs[i]! && open(nodes[current]!, nodes[i]!)) { costs[i] = cost; previous[i] = current; }
    }
  }
  return goal;
}

export function journeyHint(sim: Simulation, gamepad: boolean): string {
  const s = sim.save, interact = gamepad ? 'Y' : 'E';
  if (sim.mode !== 'playing') return '';
  if (s.bossDefeated) return `Sigue la luz al altar. ${interact} · Restaurar al acercarte.`;
  if (s.doorUnlocked) return 'Punto de control activo. Avanza hacia la cámara del Guardián.';
  if (s.hasKey) return sim.player.x > 7 && sim.player.z > 57 && sim.player.z < 65
    ? 'Sal por la reja abierta y sigue la luz hacia el santuario.'
    : `Sigue el sendero. ${interact} · Abrir al acercarte a la puerta.`;
  if (s.grateOpened) return `Entra por la reja abierta, al frente del recinto. ${interact} · Abrir cofre.`;
  if (sim.ruinsSwitchReady) return `Busca el cristal iluminado. ${interact} · Activar al acercarte.`;
  if (s.checkpoint !== 'start') return 'El Espíritu protege el interruptor que abre el paso al cofre.';
  if (sim.player.z > 16) return 'Purifica ambos Brotes para liberar el sendero y guardar un recuerdo.';
  return gamepad ? 'Stick izquierdo · Camina hacia la luz. A · Salta.' : 'WASD · Camina hacia la luz. Espacio · Salta.';
}
