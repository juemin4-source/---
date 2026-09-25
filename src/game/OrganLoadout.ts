import type { OrganId } from "./config";
import { dominantArchetype, type Archetype } from "./expedition/Counters";

/** A body's organ build: which organs it carries and how many stacks of each. Shared by enemies. */
export class OrganLoadout {
  private stacks: Partial<Record<OrganId, number>> = {};
  constructor(initial?: Partial<Record<OrganId, number>> | OrganId[]) {
    if (Array.isArray(initial)) for (const id of initial) this.add(id);
    else if (initial) for (const [id, n] of Object.entries(initial)) this.add(id as OrganId, n ?? 0);
  }
  has(id: OrganId) {
    return (this.stacks[id] ?? 0) > 0;
  }
  count(id: OrganId) {
    return this.stacks[id] ?? 0;
  }
  add(id: OrganId, n = 1) {
    if (n <= 0) return;
    this.stacks[id] = (this.stacks[id] ?? 0) + Math.floor(n);
  }
  remove(id: OrganId) {
    delete this.stacks[id];
  }
  clear() {
    this.stacks = {};
  }
  entries() {
    return Object.entries(this.stacks).filter(([, n]) => (n ?? 0) > 0) as [OrganId, number][];
  }
  ids() {
    return this.entries().map(([id]) => id);
  }
  get totalLayers() {
    return this.entries().reduce((s, [, n]) => s + n, 0);
  }
  get uniqueCount() {
    return this.entries().length;
  }
  /** Highest-stacked organ; used for colour and a one-word label. */
  get primary(): OrganId | undefined {
    return this.entries().sort((a, b) => b[1] - a[1])[0]?.[0];
  }
  /** Dominant archetype of this build — what it tends to beat. See expedition/Counters. */
  dominant(): Archetype | null {
    return dominantArchetype(this.toJSON());
  }
  toJSON() {
    return Object.fromEntries(this.entries());
  }
}
