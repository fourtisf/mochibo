import { describe, expect, it } from "vitest";

describe("SSR safety", () => {
  it("imports without window or document and reports no WebGL / no low-power", async () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
    const mod = await import("./index");
    expect(typeof mod.createStage).toBe("function");
    expect(typeof mod.renderThumbnail).toBe("function");
    expect(mod.hasWebGL()).toBe(false);
    expect(mod.isLowPowerDevice()).toBe(false);
    expect(mod.getLowPower()).toBe(false);
    mod.setLowPower(true);
    expect(mod.getLowPower()).toBe(true);
  });
});
