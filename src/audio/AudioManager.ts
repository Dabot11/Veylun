export class AudioManager {
  private context: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  volume = .35;
  private lastStep = 0;

  unlock(): void {
    try { this.context ??= new AudioContext(); void this.context.resume(); }
    catch { /* Audio may be unavailable. */ }
  }

  play(name: string, strong = false): void {
    if (!this.context || this.context.state !== 'running' || this.volume === 0) return;
    const ctx = this.context, t = ctx.currentTime;
    if (name === 'step') {
      if (t - this.lastStep < .28) return;
      this.lastStep = t;
    }
    if (name === 'sword') { this.burst(.11, 2100, .11); return; }
    if (name === 'spirit-charge') {
      this.tone(280, 1000, t, .75, .12, 'sine');
      this.tone(560, 1600, t + .15, .6, .06, 'sine');
      return;
    }
    if (name === 'magic-impact') { this.burst(.09, 1500, .1); return; }
    if (name === 'hit') {
      this.burst(strong ? .15 : .09, strong ? 1000 : 1800, strong ? .32 : .22);
      this.tone(strong ? 130 : 190, strong ? 45 : 70, t, .16, strong ? .38 : .26, 'triangle');
      return;
    }
    if (name === 'shield') {
      this.burst(.06, 3200, .13);
      this.tone(1250, 800, t, .2, .20, 'sine');
      this.tone(1875, 1200, t, .13, .09, 'sine');
      return;
    }
    const notes: Record<string, number[]> = {
      step: [110], hurt: [160, 100], dodge: [220, 90], projectile: [780, 480],
      switch: [420, 640], door: [100, 160], chest: [523, 659, 784],
      checkpoint: [392, 523, 659], death: [220, 165, 110],
      'enemy-death': [440, 660], 'magic-dodge':[880], restore: [262, 330, 392, 523, 659], victory: [523, 659, 784, 1047],
    };
    notes[name]?.forEach((frequency, i) => {
      this.tone(frequency, frequency, t + i * .12, .22, name === 'step' ? .05 : .17,
        ['hurt', 'step'].includes(name) ? 'triangle' : 'sine');
    });
  }

  private tone(from: number, to: number, time: number, duration: number, volume: number, type: OscillatorType): void {
    const ctx = this.context!, oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, time);
    oscillator.frequency.exponentialRampToValueAtTime(to, time + duration);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(this.volume * volume, time + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(gain); gain.connect(ctx.destination);
    oscillator.start(time); oscillator.stop(time + duration + .02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }

  private burst(duration: number, cutoff: number, volume: number): void {
    const ctx = this.context!, t = ctx.currentTime;
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .25), ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = this.noise;
    filter.type = 'bandpass'; filter.Q.value = .6;
    filter.frequency.setValueAtTime(cutoff, t);
    filter.frequency.exponentialRampToValueAtTime(cutoff * .35, t + duration);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(this.volume * volume, t + .004);
    gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
    source.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    source.start(t); source.stop(t + duration + .01);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }

  dispose(): void { void this.context?.close(); }
}
