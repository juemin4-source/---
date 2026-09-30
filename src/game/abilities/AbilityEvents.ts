import type { Projectile } from "../../engine/Projectile";
import type { Carrier } from "../SliceWorld";
export type Tag =
  | "Projectile"
  | "Heavy"
  | "Melee"
  | "Explosion"
  | "Deploy"
  | "Tether"
  | "Summon"
  | "PhysicalObject"
  | "Returning"
  | "Copy"
  | "Child";
export type EventName =
  | "AttackCreated"
  | "ProjectileHit"
  | "ProjectileReturn"
  | "ProjectileExpire"
  | "WallHit"
  | "HeavyHit"
  | "BeforeDamage"
  | "Kill"
  | "Dash"
  | "ShieldBreak"
  | "Deploy"
  | "Push"
  | "Explosion";
export interface AbilityEvent {
  type: EventName;
  tags: Set<Tag>;
  projectile?: Projectile;
  target?: Carrier;
  x: number;
  y: number;
  amount: number;
  heavy?: boolean;
  radius?: number;
  cancel?: boolean;
}
/** Ordered listeners; mutable payloads are resolved before the caller commits the action. */
export class AbilityEvents {
  readonly counts: Partial<Record<EventName, number>> = {};
  private listeners = new Map<EventName, ((e: AbilityEvent) => void)[]>();
  on(type: EventName, listener: (e: AbilityEvent) => void) {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }
  emit(e: AbilityEvent) {
    this.counts[e.type] = (this.counts[e.type] ?? 0) + 1;
    for (const fn of this.listeners.get(e.type) ?? []) fn(e);
    return e;
  }
}
