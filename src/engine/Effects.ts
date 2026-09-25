export type EffectKind =
  | "shot"
  | "hit"
  | "detach"
  | "phase"
  | "break"
  | "dash"
  | "melee"
  | "hurt"
  | "kill"
  | "ram"
  | "heavy"
  | "eliteKill"
  | "blast"
  | "wallSlam"
  | "shatter"
  | "stagger"
  | "perfect"
  | "parry"
  | "slam";

export interface Effect {
  kind: EffectKind;
  x: number;
  y: number;
  color: number;
  life: number;
  maxLife: number;
  angle: number;
}

/** Tone + noise impact recipes. `pitch` scales frequency, `gain` scales loudness. */
const notes: Record<EffectKind, [number, number, number, number]> = {
  //        start  end   seconds  gain
  shot: [240, 70, 0.045, 0.024],
  hit: [110, 45, 0.055, 0.075],
  detach: [160, 780, 0.24, 0.075],
  phase: [400, 1050, 0.2, 0.075],
  break: [170, 30, 0.16, 0.075],
  dash: [120, 320, 0.09, 0.075],
  melee: [90, 300, 0.12, 0.075],
  hurt: [120, 40, 0.2, 0.075],
  kill: [90, 22, 0.2, 0.075],
  ram: [65, 190, 0.18, 0.075],
  heavy: [180, 32, 0.18, 0.1],
  eliteKill: [70, 18, 0.7, 0.12],
  blast: [150, 26, 0.3, 0.095],
  wallSlam: [120, 34, 0.2, 0.095],
  shatter: [900, 180, 0.28, 0.09],
  stagger: [320, 60, 0.26, 0.1],
  perfect: [520, 1400, 0.22, 0.08],
  parry: [660, 1500, 0.26, 0.09],
  slam: [110, 24, 0.28, 0.11],
};
/** Kinds that also get a filtered noise burst, which is what makes impacts feel physical. */
const noisy = new Set<EffectKind>([
  "hit",
  "heavy",
  "kill",
  "eliteKill",
  "blast",
  "wallSlam",
  "shatter",
  "stagger",
  "slam",
  "break",
  "hurt",
  "ram",
  "parry",
]);
const sineLike = new Set<EffectKind>(["phase", "detach", "perfect", "parry"]);

export class Synth {
  context: AudioContext | null = null;
  master: GainNode | null = null;
  muted = false;
  private noiseBuffer: AudioBuffer | null = null;
  private lastPlay: Record<string, number> = {};

  unlock() {
    this.context ??= new AudioContext();
    if (this.context.state === "suspended") void this.context.resume();
  }

  /** Cheap limiter so overlapping impacts do not clip. */
  private out() {
    const ctx = this.context!;
    if (!this.master) {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 8;
      comp.attack.value = 0.003;
      comp.release.value = 0.15;
      const master = ctx.createGain();
      master.gain.value = 0.85;
      master.connect(comp);
      comp.connect(ctx.destination);
      this.master = master;
    }
    return this.master;
  }

  private noise() {
    const ctx = this.context!;
    if (!this.noiseBuffer) {
      const len = Math.floor(ctx.sampleRate * 0.4);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    return src;
  }

  play(kind: EffectKind, pitch = 1) {
    if (!this.context || this.muted) return;
    const ctx = this.context,
      t = ctx.currentTime,
      [start, end, duration, gain] = notes[kind];
    // Rate limit: identical cues closer than a few ms would just smear into noise.
    const gap = kind === "shot" ? 0.03 : 0.02;
    if (this.lastPlay[kind] !== undefined && t - this.lastPlay[kind] < gap) return;
    this.lastPlay[kind] = t;
    const out = this.out();
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = sineLike.has(kind) ? "sine" : kind === "shot" ? "square" : "triangle";
    o.frequency.setValueAtTime(Math.min(16000, start * pitch), t);
    o.frequency.exponentialRampToValueAtTime(
      Math.max(12, Math.min(16000, end * (kind === "shot" ? 1 : pitch))),
      t + duration,
    );
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + duration);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + duration + 0.02);
    if (noisy.has(kind)) {
      const src = this.noise(),
        ng = ctx.createGain(),
        lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(Math.min(9000, 2600 * pitch), t);
      lp.frequency.exponentialRampToValueAtTime(300, t + duration * 1.3);
      ng.gain.setValueAtTime(gain * 0.9, t);
      ng.gain.exponentialRampToValueAtTime(0.0008, t + duration * 1.3);
      src.connect(lp);
      lp.connect(ng);
      ng.connect(out);
      src.start(t);
      src.stop(t + duration * 1.4 + 0.02);
    }
  }

  /** Sustained wind-up / alarm tone for telegraphed attacks. */
  warn(strength = 1) {
    if (!this.context || this.muted) return;
    const ctx = this.context,
      t = ctx.currentTime,
      o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(300, t);
    o.frequency.exponentialRampToValueAtTime(1500, t + 0.32);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05 * strength, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.34);
    o.connect(g);
    g.connect(this.out());
    o.start(t);
    o.stop(t + 0.36);
  }
}
