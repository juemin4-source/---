/** Deterministic PRNG (mulberry32). Ecology code must never call Math.random(). */
export class SeededRandom {
  private s: number;
  constructor(seed: number) {
    this.s = (Math.floor(seed) ^ 0x9e3779b9) >>> 0;
  }
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min: number, max: number) {
    return min + (max - min) * this.next();
  }
  int(min: number, maxInclusive: number) {
    return Math.floor(this.range(min, maxInclusive + 1));
  }
  chance(p: number) {
    return this.next() < p;
  }
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
  weighted<T extends string>(weights: Partial<Record<T, number>>): T {
    const entries = Object.entries(weights) as [T, number][];
    let r = this.next() * entries.reduce((s, [, w]) => s + w, 0);
    for (const [k, w] of entries) if ((r -= w) <= 0) return k;
    return entries[entries.length - 1][0];
  }
}
