import { afterEach, describe, expect, it, vi } from "vitest";
import { Expedition } from "../src/Expedition";
import { ExpeditionUI } from "../src/ExpeditionUI";

afterEach(() => vi.unstubAllGlobals());

describe("expedition overlay visibility", () => {
  it("reveals the field after departure and after closing the map, including a cached field signature", () => {
    const nodes = {
      hud: { hidden: false, innerHTML: "" },
      overlay: { hidden: true, innerHTML: "", className: "" },
    };
    vi.stubGlobal("document", {
      getElementById: (id: keyof typeof nodes) => nodes[id],
    });
    const expedition = new Expedition(),
      ui = new ExpeditionUI();

    ui.render(expedition, "", false);
    expect(nodes.hud.hidden).toBe(true);
    expect(nodes.overlay.hidden).toBe(false);
    expect(nodes.overlay.innerHTML).toContain("开始第一次出行");

    expedition.start(173);
    // The departure handler may invalidate content to the same signature as a bare field.
    // Visibility still has to change even when no overlay HTML needs to be rebuilt.
    ui.signature = "";
    ui.render(expedition, "", false);
    expect(nodes.hud.hidden).toBe(false);
    expect(nodes.overlay.hidden).toBe(true);
    expect(nodes.overlay.className).not.toContain("hub-overlay");

    ui.render(expedition, "map", false);
    expect(nodes.overlay.hidden).toBe(false);
    expect(nodes.overlay.innerHTML).toContain("收起地图");
    ui.render(expedition, "", false);
    expect(nodes.overlay.hidden).toBe(true);
    ui.render(expedition, "", false);
    expect(nodes.overlay.hidden).toBe(true);

    expedition.finish("extracted");
    ui.render(expedition, "", false);
    expect(nodes.overlay.hidden).toBe(false);
    expect(nodes.hud.hidden).toBe(true);
    expect(nodes.overlay.innerHTML).toContain("再次出发");
  });
});
