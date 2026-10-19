/** Shared simulation, input, camera and combat balance. */
export const gameConfig = {
  simulation: { stepSeconds: 1 / 60, maxFrameSeconds: 0.1 },
  input: { deadzone: 0.18, triggerThreshold: 0.5 },
  player: { height: 1.45, walkSpeed: 2.2, runSpeed: 4.8, jumpHeight: 1.3, gravity: -18, coyoteTime: 0.1, jumpBuffer: 0.12, maxHealth: 10 },
  camera: { distance: 5, minDistance: 1.2, maxDistance: 8, lockRange: 14 },
  combat: { maxCombo: 3, shieldArcDegrees: 110, dodgeDuration: 0.45, dodgeInvulnerability: 0.25, damageInvulnerability: 0.7 },
  enemies: { sprout: { health: 3, damage: 1 }, spirit: { health: 2, damage: 1 }, guardian: { health: 12, damage: 2 } },
} as const;
