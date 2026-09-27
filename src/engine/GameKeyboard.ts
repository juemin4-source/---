const bindings: Record<string, string> = {
  KeyA: "A",
  KeyD: "D",
  KeyS: "S",
  KeyW: "W",
  Space: "SPACE",
  ShiftLeft: "SHIFT",
  ShiftRight: "SHIFT",
  KeyE: "E",
  KeyQ: "Q",
  KeyH: "H",
  KeyF: "F",
  KeyB: "B",
  KeyR: "R",
  Tab: "TAB",
  Escape: "ESC",
  KeyM: "M",
  F3: "F3",
  Digit1: "ONE",
  Digit2: "TWO",
  Digit3: "THREE",
  Digit4: "FOUR",
  Digit5: "FIVE",
  Digit6: "SIX",
  Digit7: "SEVEN",
  Digit8: "EIGHT",
  Digit9: "NINE",
};

/** Physical keys remain stable when an IME reports keyCode 229 / key Process. */
export class GameKeyboard {
  keys = Object.fromEntries(Object.values(bindings).map((name) => [name, { isDown: false }]));
  edges = new Set<string>();
  private held = new Set<string>();

  constructor(private target: EventTarget) {
    target.addEventListener("keydown", this.down, { capture: true });
    target.addEventListener("keyup", this.up, { capture: true });
    target.addEventListener("blur", this.reset);
  }
  private down = (event: Event) => {
    const e = event as KeyboardEvent,
      name = bindings[e.code];
    const element = e.target as HTMLElement | null;
    if (!name || e.ctrlKey || e.metaKey || e.altKey) return;
    if (
      name !== "ESC" &&
      element?.closest?.("input, textarea, select, [contenteditable]:not([contenteditable=false])")
    )
      return;
    e.preventDefault();
    // Do not discard isComposing events: those are precisely the movement keys an IME masks.
    if (!this.keys[name].isDown && !e.repeat) this.edges.add(name);
    this.held.add(e.code);
    this.keys[name].isDown = true;
  };
  private up = (event: Event) => {
    const e = event as KeyboardEvent,
      name = bindings[e.code];
    if (!name) return;
    this.held.delete(e.code);
    this.keys[name].isDown = [...this.held].some((code) => bindings[code] === name);
  };
  reset = () => {
    this.held.clear();
    this.edges.clear();
    for (const key of Object.values(this.keys)) key.isDown = false;
  };
  destroy() {
    this.target.removeEventListener("keydown", this.down, { capture: true });
    this.target.removeEventListener("keyup", this.up, { capture: true });
    this.target.removeEventListener("blur", this.reset);
    this.reset();
  }
}
