import { describe, expect, test } from "vitest";
import {
  DEFAULT_PREFS,
  PREFS_COOKIE_NAME,
  resolvePrefs,
} from "~/contracts/http/shared/prefs-cookie";

function prefsCookie(prefs: unknown) {
  return `${PREFS_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(prefs))}`;
}

describe("Prefs cookie contract", () => {
  test("a saved Favo palette comes back with the rest of the prefs", () => {
    const prefs = { locale: "en", theme: "light", palette: "favo" };

    expect(resolvePrefs(prefsCookie(prefs))).toEqual(prefs);
  });

  test("a cookie saved before palettes existed keeps its prefs on Barro", () => {
    expect(resolvePrefs(prefsCookie({ locale: "en", theme: "light" }))).toEqual(
      { locale: "en", theme: "light", palette: "barro" },
    );
  });

  test("a cookie saved with the removed Terminal palette falls back to the default prefs on Barro", () => {
    const prefs = resolvePrefs(
      prefsCookie({ locale: "en", theme: "light", palette: "terminal" }),
    );

    expect(prefs).toEqual(DEFAULT_PREFS);
    expect(prefs.palette).toBe("barro");
  });

  test("an unknown palette falls back to the default prefs", () => {
    expect(
      resolvePrefs(
        prefsCookie({ locale: "en", theme: "light", palette: "neon" }),
      ),
    ).toEqual(DEFAULT_PREFS);
  });

  test("Barro is the default palette", () => {
    expect(resolvePrefs("")).toMatchObject({ palette: "barro" });
  });
});
