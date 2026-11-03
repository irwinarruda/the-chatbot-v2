import { useRouteContext } from "@tanstack/react-router";
import type { Prefs } from "~/client/shared/app/entities/Prefs";
import { useApp } from "~/client/shared/stores/app";

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
