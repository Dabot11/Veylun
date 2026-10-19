/** Device-independent contract for the future gameplay input adapters. */
export type Action = 'jump' | 'dodge' | 'attack' | 'interact' | 'shield' | 'target' | 'previousTarget' | 'nextTarget' | 'pause';
export interface ActionState { held: boolean; pressed: boolean; released: boolean }
export interface InputFrame {
  movement: { x: number; y: number };
  look: { x: number; y: number };
  actions: Record<Action, ActionState>;
  device: 'keyboard-mouse' | 'gamepad';
}

/** Standard mapping only. Non-standard pads must be diagnosed, not assumed. */
export const xboxStandardButtons: Record<Action, number> = {
  jump: 0, dodge: 1, attack: 2, interact: 3, shield: 6, target: 7,
  previousTarget: 4, nextTarget: 5, pause: 9,
};

export const keyboardCodes: Partial<Record<Action, readonly string[]>> = {
  jump: ['Space'], dodge: ['ShiftLeft', 'ShiftRight'], attack: ['KeyJ'],
  interact: ['KeyE'], shield: ['KeyK'], target: ['KeyQ'], nextTarget: ['Tab'], pause: ['Escape'],
};
