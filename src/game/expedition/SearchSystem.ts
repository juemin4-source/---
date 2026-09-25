import { distance } from "../../engine/PhysicsHelpers";
import type { LootPile } from "./LootSystem";

export type SearchInterrupt = "released" | "moved" | "damaged" | "attacked" | "left" | null;

export interface SearchState {
  pile: LootPile | null;
  /** 0..1 */
  progress: number;
  /** Seconds of held E already spent. */
  elapsed: number;
  /** Noise emitted so far, which is what the ecology reacts to. */
  noise: number;
  interrupted: SearchInterrupt;
  /** Set for one frame when a search finishes, so the caller can hand the loot over. */
  completedPile: LootPile | null;
}

export const freshSearch = (): SearchState => ({
  pile: null,
  progress: 0,
  elapsed: 0,
  noise: 0,
  interrupted: null,
  completedPile: null,
});

/** Seconds of uninterrupted hold needed, from the pile's difficulty. */
export const searchSeconds = (difficulty: number) => 0.8 + difficulty * 0.42;
/** Noise per second while searching. Harder caches are noisier, so greed draws attention. */
export const searchNoiseRate = (difficulty: number) => 0.5 + difficulty * 0.34;

export interface SearchInput {
  /** E is currently held. */
  holding: boolean;
  /** Player is able to search (grounded, not dashing). */
  canSearch: boolean;
  playerX: number;
  playerY: number;
  /** Player took damage this frame. */
  damaged: boolean;
  /** Player attacked this frame. */
  attacked: boolean;
}

export interface SearchStep {
  /** Noise emitted this frame, as a world event. */
  noise: number;
  /** Set on the frame the search finished. */
  completed: LootPile | null;
  /** Set on the frame a search was interrupted, for the telemetry record. */
  interrupted: SearchInterrupt;
  /** Player walking away from the pile mid-search. */
  target: LootPile | null;
}

export const SEARCH_RANGE = 78;

/**
 * Hold-E search. The point of the design is that searching is a commitment: it takes time, it makes
 * noise, and anything that happens to you cancels it. Releasing E, walking away, taking damage or
 * attacking all break the hold, and progress is lost rather than paused.
 */
export function stepSearch(
  s: SearchState,
  dt: number,
  input: SearchInput,
  nearest: (x: number, y: number) => LootPile | null,
): SearchStep {
  const out: SearchStep = { noise: 0, completed: null, interrupted: null, target: s.pile };
  s.completedPile = null;
  if (!input.holding || !input.canSearch || input.damaged || input.attacked) {
    if (s.pile) {
      out.interrupted = input.damaged
        ? "damaged"
        : input.attacked
          ? "attacked"
          : !input.holding
            ? "released"
            : "moved";
      s.interrupted = out.interrupted;
      out.target = null;
    }
    s.pile = null;
    s.progress = 0;
    s.elapsed = 0;
    s.noise = 0;
    return out;
  }
  if (!s.pile) {
    const found = nearest(input.playerX, input.playerY);
    if (!found) return out;
    s.pile = found;
    s.progress = 0;
    s.elapsed = 0;
    s.noise = 0;
    s.interrupted = null;
    out.target = found;
  }
  // Walking away abandons the search, and the progress goes with it.
  if (distance({ x: input.playerX, y: input.playerY }, s.pile) > SEARCH_RANGE) {
    s.pile = null;
    s.progress = 0;
    s.elapsed = 0;
    s.noise = 0;
    out.interrupted = "left";
    out.target = null;
    return out;
  }
  const need = searchSeconds(s.pile.difficulty);
  s.elapsed += dt;
  s.progress = Math.min(1, s.elapsed / need);
  const rate = searchNoiseRate(s.pile.difficulty);
  s.noise += rate * dt;
  out.noise = rate * dt;
  if (s.progress >= 1) {
    const pile = s.pile;
    s.completedPile = pile;
    out.completed = pile;
    s.pile = null;
    s.progress = 0;
    s.elapsed = 0;
    s.noise = 0;
    out.target = null;
  }
  return out;
}
