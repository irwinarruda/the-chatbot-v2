import { Navigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useApp } from "~/client/shared/stores/app";
import {
  isWebLoginReturnPath,
  normalizeWebLoginRedirect,
} from "~/contracts/http/identity/web-login-navigation";

export function SessionBoundary({ children }: { children: ReactNode }) {
  const isLoggingOut = useApp((state) => state.isLoggingOut);
  const isSessionExpired = useApp((state) => state.isSessionExpired);
  const location = useRouterState({ select: (state) => state.location });
  const isProtectedRoute = isWebLoginReturnPath(location.pathname);
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
