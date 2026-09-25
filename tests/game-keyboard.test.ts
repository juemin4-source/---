import { describe, expect, it } from "vitest";
import { GameKeyboard } from "../src/engine/GameKeyboard";
import { SliceWorld } from "../src/game/SliceWorld";
import { idleControls } from "../src/engine/Player";

function send(target: EventTarget, type: string, code: string, extra = {}) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { code, keyCode: 229, key: "Process", isComposing: true, ...extra });
  target.dispatchEvent(event);
  return event;
}

describe("physical game keyboard", () => {
  it("keeps moving through repeated keydowns and resumes after release and reset", () => {
    const target = new EventTarget(),
      input = new GameKeyboard(target);
    const w = new SliceWorld(false, 1, false, true, true),
      c = idleControls();
    const move = () => {
      for (let i = 0; i < 36; i++) {
        c.right = input.keys.D.isDown;
        w.update(1 / 120, c);
      }
    };
    for (let cycle = 0; cycle < 3; cycle++) {
      const before = w.player.x;
      expect(send(target, "keydown", "KeyD").defaultPrevented).toBe(true);
      move();
      send(target, "keydown", "KeyD", { repeat: true });
      move();
      expect(w.player.x - before).toBeGreaterThan(100);
      send(target, "keyup", "KeyD");
      expect(input.keys.D.isDown).toBe(false);
      input.reset();
    }
    input.destroy();
  });
  it("clears held keys on blur and removes listeners on shutdown", () => {
    const target = new EventTarget(),
      input = new GameKeyboard(target);
    send(target, "keydown", "KeyA");
    target.dispatchEvent(new Event("blur"));
    expect(input.keys.A.isDown).toBe(false);
    expect(input.edges.size).toBe(0);
    input.destroy();
    send(target, "keydown", "KeyA");
    expect(input.keys.A.isDown).toBe(false);
  });
  it("handles both Shift keys and does not retrigger one-shot actions on repeat", () => {
    const target = new EventTarget(),
      input = new GameKeyboard(target);
    send(target, "keydown", "ShiftLeft");
    input.edges.clear();
    send(target, "keydown", "ShiftLeft", { repeat: true });
    expect(input.edges.size).toBe(0);
    send(target, "keydown", "ShiftRight");
    send(target, "keyup", "ShiftLeft");
    expect(input.keys.SHIFT.isDown).toBe(true);
    send(target, "keyup", "ShiftRight");
    expect(input.keys.SHIFT.isDown).toBe(false);
    input.destroy();
  });
  it("leaves browser shortcuts alone", () => {
    const target = new EventTarget(),
      input = new GameKeyboard(target);
    expect(send(target, "keydown", "KeyR", { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(input.keys.R.isDown).toBe(false);
    input.destroy();
  });
});
