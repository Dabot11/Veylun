import { describe, expect, it } from 'vitest';
import { FixedStepLoop } from '../../src/core/FixedStepLoop';

describe('FixedStepLoop', () => {
  it('advances the same simulation time at 30, 60 and 144 render FPS', () => {
    for (const fps of [30, 60, 144]) {
      const loop = new FixedStepLoop();
      let simulated = 0;
      for (let frame = 0; frame < fps; frame++) loop.advance(1 / fps, (dt) => { simulated += dt; });
      expect(simulated).toBeCloseTo(1, 10);
    }
  });
  it('caps tab-suspension catch-up to avoid a simulation spiral', () => {
    expect(new FixedStepLoop().advance(30, () => {})).toBe(6);
  });
  it('resets accumulated partial steps and ignores invalid elapsed time', () => {
    const loop = new FixedStepLoop();
    loop.advance(0.01, () => {});
    loop.reset();
    expect(loop.advance(0.01, () => {})).toBe(0);
    for (const dt of [NaN, Infinity, -1]) expect(loop.advance(dt, () => {})).toBe(0);
  });
  it('rejects configurations that could cause an infinite loop', () => {
    for (const step of [0, -1, NaN, Infinity]) expect(() => new FixedStepLoop(step)).toThrow(RangeError);
    expect(() => new FixedStepLoop(1, 0.1)).toThrow(RangeError);
  });
});
