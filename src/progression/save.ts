import type { SaveDataV1 } from './types';
export const SAVE_KEY = 'veylun.save.v1';
export const freshSave = (): SaveDataV1 => ({ version: 1, checkpoint: 'start', reachedZone: 'awakening', hasKey: false, chestOpened: false, switchActivated: false, grateOpened: false, doorUnlocked: false, defeatedOrdinaryEnemies: [], bossDefeated: false, altarActivated: false, completed: false, playedSeconds: 0, deaths: 0 });
export function parseSave(text: string | null): SaveDataV1 | null {
  try {
    const s: unknown = JSON.parse(text ?? 'null');
    if (!s || typeof s !== 'object') return null;
    const o = s as Record<string, unknown>;
    if (o['version'] !== 1 || !['start', 'after-sprouts', 'before-guardian'].includes(String(o['checkpoint'])) || !['awakening', 'roots', 'ruins', 'gate', 'guardian'].includes(String(o['reachedZone']))) return null;
    const bools = ['hasKey','chestOpened','switchActivated','grateOpened','doorUnlocked','bossDefeated','altarActivated','completed'];
    if (bools.some(k => typeof o[k] !== 'boolean')) return null;
    if (typeof o['playedSeconds'] !== 'number' || !Number.isFinite(o['playedSeconds']) || o['playedSeconds'] < 0 || typeof o['deaths'] !== 'number' || !Number.isSafeInteger(o['deaths']) || o['deaths'] < 0) return null;
    const ids = o['defeatedOrdinaryEnemies'];
    if (!Array.isArray(ids) || ids.some(id => !['sprout-1','sprout-2','spirit-1'].includes(id)) || new Set(ids).size !== ids.length) return null;
    // Reject impossible progress rather than granting access through a corrupt save.
    if (o['chestOpened'] !== o['hasKey'] || o['grateOpened'] !== o['switchActivated'] || (o['switchActivated'] && !ids.includes('spirit-1')) || (o['hasKey'] && !o['grateOpened']) || (o['doorUnlocked'] && !o['hasKey']) || (o['bossDefeated'] && !o['doorUnlocked']) || (o['altarActivated'] && !o['bossDefeated']) || o['completed'] !== o['altarActivated']) return null;
    if (o['checkpoint'] !== 'start' && !(ids.includes('sprout-1') && ids.includes('sprout-2'))) return null;
    if (o['checkpoint'] === 'before-guardian' && !o['doorUnlocked']) return null;
    return JSON.parse(JSON.stringify(o)) as SaveDataV1;
  } catch { return null; }
}
export class SaveStore {
  warning = '';
  constructor(private storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) {}
  read(): SaveDataV1 | null {
    try {
      const raw = this.storage.getItem(SAVE_KEY); const parsed = parseSave(raw);
      if (raw && !parsed) this.warning = 'El guardado no es compatible o está dañado. Puedes comenzar otra partida.';
      return parsed;
    } catch { this.warning = 'El navegador no permite leer el guardado local.'; return null; }
  }
  write(save: SaveDataV1): void { try { this.storage.setItem(SAVE_KEY, JSON.stringify(save)); this.warning=''; } catch { this.warning = 'No se pudo guardar. La partida continúa en memoria.'; } }
  clear(): void { try { this.storage.removeItem(SAVE_KEY); this.warning=''; } catch { this.warning = 'No se pudo borrar el guardado del navegador.'; } }
}
