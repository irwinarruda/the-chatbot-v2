import { createMiddleware } from "@tanstack/react-start";
import { WebAuth, type WebAuthContext } from "~/server/utils/WebAuth";

const PROTECTED_WEB_API_PATHS = new Set([
  "/api/v1/web/audio",
  "/api/v1/web/auth/me",
  "/api/v1/web/messages",
  "/api/v1/web/stream",
]);

export const authMiddleware = createMiddleware({
  type: "request",
}).server<WebAuthContext>(async ({ next, pathname, request }) => {
  if (!PROTECTED_WEB_API_PATHS.has(pathname)) {
    return next({ context: {} as WebAuthContext });
  }
  const webAuth = await WebAuth.requireAuth(request);
  return next({ context: { webAuth } });
});
