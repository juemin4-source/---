export type EffectKind =
  "shot" | "hit" | "detach" | "phase" | "break" | "dash" | "melee" | "hurt" | "kill" | "ram";
export interface Effect {
  kind: EffectKind;
  x: number;
  y: number;
  color: number;
  life: number;
  maxLife: number;
  angle: number;
}
export class Synth {
  context: AudioContext | null = null;
  muted = false;
  unlock() {
    this.context ??= new AudioContext();
    if (this.context.state === "suspended") void this.context.resume();
  }
  play(kind: EffectKind) {
    if (!this.context || this.muted) return;
    const ctx = this.context,
      o = ctx.createOscillator(),
      g = ctx.createGain(),
      t = ctx.currentTime;
    const notes: Record<EffectKind, [number, number, number]> = {
      shot: [240, 70, 0.045],
      hit: [110, 45, 0.055],
      detach: [160, 780, 0.24],
      phase: [400, 1050, 0.2],
      break: [170, 30, 0.16],
      dash: [120, 320, 0.09],
      melee: [90, 300, 0.12],
      hurt: [120, 40, 0.2],
      kill: [90, 22, 0.2],
      ram: [65, 190, 0.18],
    };
    const [start, end, duration] = notes[kind];
    o.type = kind === "phase" || kind === "detach" ? "sine" : "triangle";
    o.frequency.setValueAtTime(start, t);
    o.frequency.exponentialRampToValueAtTime(end, t + duration);
    g.gain.setValueAtTime(kind === "shot" ? 0.024 : 0.075, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + duration + 0.01);
  }
}
