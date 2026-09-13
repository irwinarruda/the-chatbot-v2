import { Navigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  normalizeWebLoginRedirect,
  WEB_LOGIN_PATHS,
} from "~/modules/identity/utils/WebLoginNavigation";
import { useApp } from "~/shared/client/stores";

export function SessionBoundary({ children }: { children: ReactNode }) {
  const isLoggingOut = useApp((state) => state.isLoggingOut);
  const isSessionExpired = useApp((state) => state.isSessionExpired);
  const location = useRouterState({ select: (state) => state.location });
  const isProtectedRoute = WEB_LOGIN_PATHS.some(
    (path) =>
      location.pathname === path || location.pathname.startsWith(`${path}/`),
  );
  if (isLoggingOut && isProtectedRoute) return null;
  if (isSessionExpired && isProtectedRoute) {
    return (
      <Navigate
        to="/login"
        search={{ redirect: normalizeWebLoginRedirect(location.href) }}
        replace
        reloadDocument
        ignoreBlocker
      />
    );
  }
  return children;
}
