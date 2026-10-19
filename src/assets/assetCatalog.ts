export type CharacterId = 'ruen' | 'corrupt-sprout' | 'wandering-spirit' | 'ancestral-guardian';
export type AnimationId = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'land' | 'roll' | 'attack1' | 'attack2' | 'attack3' | 'shield' | 'hurt' | 'death' | 'interact' | 'victory';

export interface CharacterAsset {
  id: CharacterId;
  status: 'awaiting-reference-review' | 'reference-2d-reviewed' | 'provisional-3d' | 'final-3d';
  /** Relative to public/. Null means no model exists; never fabricate a URL. */
  modelPath: string | null;
  heightMeters: number;
  animationNames: Partial<Record<AnimationId, string>>;
}

export const characterAssets: Record<CharacterId, CharacterAsset> = {
  ruen: { id: 'ruen', status: 'provisional-3d', modelPath: null, heightMeters: 1.45, animationNames: {} },
  'corrupt-sprout': { id: 'corrupt-sprout', status: 'provisional-3d', modelPath: null, heightMeters: 1.1, animationNames: {} },
  'wandering-spirit': { id: 'wandering-spirit', status: 'provisional-3d', modelPath: null, heightMeters: 1.25, animationNames: {} },
  'ancestral-guardian': { id: 'ancestral-guardian', status: 'provisional-3d', modelPath: null, heightMeters: 4.2, animationNames: {} },
};

export function assetUrl(path: string, base = import.meta.env.BASE_URL): string {
  if (path.startsWith('/') || path.includes('..') || path.includes(':') || path.includes('\\')) {
    throw new Error('Asset paths must be relative to public/.');
  }
  return `${base.endsWith('/') ? base : `${base}/`}${path}`;
}
