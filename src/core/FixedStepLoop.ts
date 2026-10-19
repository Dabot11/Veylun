/** Separates deterministic simulation updates from the browser render cadence. */
export class FixedStepLoop {
  private accumulator = 0;

  constructor(readonly stepSeconds = 1 / 60, readonly maxFrameSeconds = 0.1) {
    if (!Number.isFinite(stepSeconds) || stepSeconds <= 0 || !Number.isFinite(maxFrameSeconds) || maxFrameSeconds < stepSeconds) {
      throw new RangeError('Invalid fixed-step configuration.');
    }
  }

  advance(elapsedSeconds: number, update: (dt: number) => void): number {
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) return 0;
    this.accumulator += Math.min(elapsedSeconds, this.maxFrameSeconds);
    let steps = 0;
    while (this.accumulator + Number.EPSILON >= this.stepSeconds) {
      update(this.stepSeconds);
      this.accumulator = Math.max(0, this.accumulator - this.stepSeconds);
      steps++;
    }
    return steps;
  }

  reset(): void { this.accumulator = 0; }
}
