import { describe, expect, test, vi } from "vitest";
import { create } from "zustand";
import type { PrefsGateway } from "~/client/shared/app/gateways/PrefsGateway";
import {
  createPrefsService,
  type PrefsService,
} from "~/client/shared/app/services/PrefsService";
import { container } from "~/client/shared/container";

describe("PrefsService", () => {
  test("switches between the Barro and Favo palettes and saves each choice", async () => {
    const gateway = { persistPrefs: vi.fn<PrefsGateway["persistPrefs"]>() };
    container.register("PrefsGateway", gateway);
    const store = create<PrefsService>()(createPrefsService);
    store
      .getState()
      .hydratePrefs({ locale: "en", theme: "light", palette: "barro" });

    await store.getState().togglePalette();

    expect(store.getState().prefs).toEqual({
      locale: "en",
      theme: "light",
      palette: "favo",
    });
    expect(gateway.persistPrefs).toHaveBeenLastCalledWith({
      locale: "en",
      theme: "light",
      palette: "favo",
    });

    await store.getState().togglePalette();

    expect(store.getState().prefs.palette).toBe("barro");
    expect(gateway.persistPrefs).toHaveBeenLastCalledWith({
      locale: "en",
      theme: "light",
      palette: "barro",
    });
  });
});
