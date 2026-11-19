import { describe, expect, test, vi } from "vitest";
import { create } from "zustand";
import type { PrefsGateway } from "~/client/shared/app/gateways/PrefsGateway";
import {
  createPrefsService,
  type PrefsService,
} from "~/client/shared/app/services/PrefsService";
import { container } from "~/client/shared/container";

describe("PrefsService", () => {
  test("saves the chosen palette with the rest of the prefs", async () => {
    const gateway = { persistPrefs: vi.fn<PrefsGateway["persistPrefs"]>() };
    container.register("PrefsGateway", gateway);
    const store = create<PrefsService>()(createPrefsService);
    store
      .getState()
      .hydratePrefs({ locale: "en", theme: "light", palette: "barro" });

    await store.getState().choosePalette("lila");

    expect(store.getState().prefs).toEqual({
      locale: "en",
      theme: "light",
      palette: "lila",
    });
    expect(gateway.persistPrefs).toHaveBeenLastCalledWith({
      locale: "en",
      theme: "light",
      palette: "lila",
    });

    await store.getState().choosePalette("favo");

    expect(store.getState().prefs.palette).toBe("favo");
    expect(gateway.persistPrefs).toHaveBeenLastCalledWith({
      locale: "en",
      theme: "light",
      palette: "favo",
    });
  });
});
