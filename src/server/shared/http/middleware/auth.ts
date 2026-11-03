import { createMiddleware } from "@tanstack/react-start";
import type { WebAuthTokenPayloadDTO } from "~/contracts/http/identity/identity";
import { getServer } from "~/server/production";
import { getWebAuthToken } from "~/server/shared/http/utils/web-auth-cookie";

const PUBLIC_WEB_API_PATHS = new Set([
  "/api/v1/web/auth/login",
  "/api/v1/web/auth/logout",
  "/api/v1/web/auth/redirect",
]);

export interface WebAuthContext {
  webAuth: WebAuthTokenPayloadDTO;
}

export const authMiddleware = createMiddleware({
  type: "request",
}).server<WebAuthContext>(async ({ next, pathname, request }) => {
  if (!requiresWebAuthentication(pathname)) {
    return next({ context: {} as WebAuthContext });
  }
  const user = await getServer().services.auth.authenticateWebUser(
    getWebAuthToken(request) ?? "",
  );
  const webAuth: WebAuthTokenPayloadDTO = {
    userId: user.id,
    email: user.email ?? "",
    phoneNumber: user.phoneNumber,
    purpose: "web-auth",
  };
  return next({ context: { webAuth } });
});

export function requiresWebAuthentication(pathname: string): boolean {
  if (!pathname.startsWith("/api/v1/web/")) return false;
  return !PUBLIC_WEB_API_PATHS.has(pathname);
}
