import { createMiddleware } from "@tanstack/react-start";
import { WebAuth, type WebAuthContext } from "~/shared/http/utils/WebAuth";

const PUBLIC_WEB_API_PATHS = new Set([
  "/api/v1/web/auth/login",
  "/api/v1/web/auth/logout",
  "/api/v1/web/auth/redirect",
]);

export const authMiddleware = createMiddleware({
  type: "request",
}).server<WebAuthContext>(async ({ next, pathname, request }) => {
  if (!requiresWebAuthentication(pathname)) {
    return next({ context: {} as WebAuthContext });
  }
  const webAuth = await WebAuth.requireAuth(request);
  return next({ context: { webAuth } });
});

export function requiresWebAuthentication(pathname: string): boolean {
  if (!pathname.startsWith("/api/v1/web/")) return false;
  return !PUBLIC_WEB_API_PATHS.has(pathname);
}
