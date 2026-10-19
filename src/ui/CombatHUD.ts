import type { Enemy, GameEvent, Simulation } from '../core/Simulation';
import { distance } from '../core/math';
import { swordHits } from '../player/combat';
import { incomingMagic } from '../enemies/spiritCombat';
import { interactables } from '../world/level';

export function combatFocus(sim: Simulation, lastHit: string | null, until: number): Enemy | undefined {
  if (sim.mode !== 'playing') return undefined;
  if (sim.target) return sim.target;
  const hit = sim.enemies.find(e => e.id === lastHit);
  if (hit && sim.age < until && distance(hit, sim.player) < 10 && sim.visibleEnemy(hit)) return hit;
  return sim.enemies.filter(e => e.hp > 0 && distance(e, sim.player) < (e.kind==='spirit'&&e.state!=='idle'?11:5.5) && sim.visibleEnemy(e))
    .sort((a, b) => distance(a, sim.player) - distance(b, sim.player))[0];
}

export class CombatHUD {
  private card: HTMLElement;
  private name: HTMLElement;
  private health: HTMLElement;
  private bar: HTMLElement;
  private state: HTMLElement;
  private lock: HTMLElement;
  private notice: HTMLElement;
  private lesson: HTMLElement;
  private switchGuide: HTMLElement;
  private lastHit: string | null = null;
  private focusUntil = 0;
  private noticeUntil = 0;

  constructor(hud: HTMLElement) {
    hud.insertAdjacentHTML('beforeend', `<section id="enemy-status" hidden aria-label="Enemigo">
      <div class="enemy-heading"><b></b><span class="enemy-lock">Fijado</span></div>
      <div class="enemy-health-row"><div class="enemy-track" role="progressbar" aria-label="Vida del enemigo"><i></i></div><span class="enemy-health"></span></div>
      <p class="enemy-state"></p></section>
      <div id="combat-notice" role="status" aria-live="polite" hidden></div>
      <p id="combat-lesson" hidden></p>
      <section id="ruins-guide" hidden><b>Interruptor liberado</b><p>Sigue el haz de luz hasta el cristal de las ruinas.</p><small></small></section>`);
    this.card = hud.querySelector('#enemy-status')!;
    this.name = this.card.querySelector('b')!;
    this.health = this.card.querySelector('.enemy-health')!;
    this.bar = this.card.querySelector('i')!;
    this.state = this.card.querySelector('.enemy-state')!;
    this.lock = this.card.querySelector('.enemy-lock')!;
    this.notice = hud.querySelector('#combat-notice')!;
    this.lesson = hud.querySelector('#combat-lesson')!;
    this.switchGuide = hud.querySelector('#ruins-guide')!;
  }

  reset(): void {
    this.lastHit = null;
    this.focusUntil = this.noticeUntil = 0;
    this.card.hidden = this.notice.hidden = this.lesson.hidden = this.switchGuide.hidden = true;
  }

  feedback(event: GameEvent, sim: Simulation): void {
    if (event.type === 'hit' && event.enemyId) {
      this.lastHit = event.enemyId;
      this.focusUntil = sim.age + (sim.enemies.find(e => e.id === event.enemyId)?.hp === 0 ? 1.2 : 3);
      this.notice.textContent = `${event.strong ? 'Golpe final' : 'Impacto'} · −${event.damage}`;
    } else if (event.type === 'magic-block') this.notice.textContent = 'Magia bloqueada · acércate y ataca';
    else if (event.type === 'magic-dodge') this.notice.textContent = 'Magia esquivada · acércate y ataca';
    else if (event.type === 'shield') this.notice.textContent = 'Bloqueado · responde con la espada';
    else return;
    this.notice.dataset['kind'] = event.type;
    this.noticeUntil = sim.age + 1.1;
  }

  update(sim: Simulation, device: string): void {
    const enemy = combatFocus(sim, this.lastHit, this.focusUntil);
    this.card.hidden = !enemy || enemy.kind === 'guardian';
    if (enemy && !this.card.hidden) {
      this.name.textContent = enemy.kind === 'sprout' ? 'Brote corrupto' : 'Espíritu errante';
      this.health.textContent = `${enemy.hp} / ${enemy.maxHp}`;
      this.bar.style.width = `${enemy.hp / enemy.maxHp * 100}%`;
      this.bar.parentElement!.setAttribute('aria-valuenow', String(enemy.hp));
      this.bar.parentElement!.setAttribute('aria-valuemin', '0');
      this.bar.parentElement!.setAttribute('aria-valuemax', String(enemy.maxHp));
      this.lock.hidden = sim.targetId !== enemy.id;
      this.card.dataset['state'] = enemy.hp === 0 ? 'dead' : enemy.state;
      const magicThreat=enemy.kind==='spirit'&&sim.projectiles.some(b=>b.ownerId===enemy.id&&incomingMagic(b,sim.player));
      this.state.textContent = enemy.hp === 0 ? 'Purificado' :
        enemy.state === 'windup' ? (enemy.kind === 'sprout' ? 'Embestida · bloquea o esquiva' : 'Preparando magia · bloquea o esquiva') :
        magicThreat ? 'Magia en camino · bloquea o esquiva' :
        enemy.kind==='spirit'&&enemy.state==='recover' ? 'Agotado · acércate y ataca' :
        enemy.state === 'attack' ? '¡Defiéndete!' :
        !swordHits(sim.player, sim.player.yaw, sim.player.y, enemy) ? 'Acércate y mira hacia el enemigo' :
        enemy.state === 'recover' ? 'Recuperándose · ataca' : 'Al alcance de tu espada';
    }
    this.notice.hidden = sim.age >= this.noticeUntil || sim.mode !== 'playing';
    const spiritLesson=enemy?.kind==='spirit'&&enemy.hp>0;
    this.lesson.hidden = !spiritLesson&&(!enemy || enemy.kind !== 'sprout' || sim.save.defeatedOrdinaryEnemies.length > 0) || sim.mode !== 'playing';
    this.lesson.textContent = spiritLesson ? (device==='gamepad'?'LT bloquea · Stick + B esquiva a un lado.\nAvanza y ataca con X cuando se agote.':'K bloquea · A/D + Shift esquiva a un lado.\nAvanza y ataca con J cuando se agote.') :
      device === 'gamepad' ? 'RT fija · LT bloquea · B esquiva.\nAtaca con X después de la embestida.' : 'Q fija · K bloquea · Shift esquiva.\nAtaca con J después de la embestida.';
    const switchDistance=distance(sim.player,interactables['ruins-switch']);
    this.switchGuide.hidden=!sim.ruinsSwitchReady||sim.mode!=='playing'||!this.card.hidden||switchDistance>18||switchDistance<2.2;
    this.switchGuide.querySelector('small')!.textContent=`${device==='gamepad'?'Y':'E'} · Activar al acercarte`;
  }
}
