import { useRouteContext } from "@tanstack/react-router";
import type { Prefs } from "~/shared/client/entities/Prefs";
import { useApp } from "~/shared/client/stores";

export function usePrefs(): Prefs {
  const routePrefs = useRouteContext({ strict: false });
  const storePrefs = useApp((state) => state.prefs);
  const isPrefsHydrated = useApp((state) => state.isPrefsHydrated);
  const isServer = typeof document === "undefined";
  if (!isServer && isPrefsHydrated) return storePrefs;
  if (routePrefs.locale && routePrefs.theme) {
    return {
      locale: routePrefs.locale,
      theme: routePrefs.theme,
    };
  }
  return storePrefs;
}
