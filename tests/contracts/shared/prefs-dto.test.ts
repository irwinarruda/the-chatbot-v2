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

  test("a cookie saved before palettes existed keeps its prefs on Terminal", () => {
    expect(resolvePrefs(prefsCookie({ locale: "en", theme: "light" }))).toEqual(
      { locale: "en", theme: "light", palette: "terminal" },
    );
  });

  test("an unknown palette falls back to the default prefs", () => {
    expect(
      resolvePrefs(
        prefsCookie({ locale: "en", theme: "light", palette: "neon" }),
      ),
    ).toEqual(DEFAULT_PREFS);
  });

  test("Terminal is the default palette", () => {
    expect(resolvePrefs("")).toMatchObject({ palette: "terminal" });
  });
});
