import { createMiddleware } from "@tanstack/react-start";
import { WebAuth, type WebAuthContext } from "~/shared/http/utils/WebAuth";

const PROTECTED_WEB_API_PATHS = new Set([
  "/api/v1/web/audio",
  "/api/v1/web/auth/me",
  "/api/v1/web/messages",
  "/api/v1/web/monthly-expenses",
  "/api/v1/web/todos",
]);

export const authMiddleware = createMiddleware({
  type: "request",
}).server<WebAuthContext>(async ({ next, pathname, request }) => {
  if (!isProtectedWebApiPath(pathname)) {
    return next({ context: {} as WebAuthContext });
  }
  const webAuth = await WebAuth.requireAuth(request);
  return next({ context: { webAuth } });
});

function isProtectedWebApiPath(pathname: string): boolean {
  return (
    PROTECTED_WEB_API_PATHS.has(pathname) ||
    pathname.startsWith("/api/v1/web/monthly-expenses/") ||
    pathname.startsWith("/api/v1/web/todos/")
  );
}
