import { createMiddleware, createStart } from "@tanstack/react-start";
import type { WebAuthTokenPayloadDTO } from "~/contracts/http/identity/identity";
import { resolvePrefs } from "~/contracts/http/shared/prefs-cookie";

export const ServerPathPrefixes = ["/api/", "/g/"];

interface WebAuthContext {
  webAuth: WebAuthTokenPayloadDTO;
}

const prefsMiddleware = createMiddleware({ type: "request" }).server(
  async ({ next, request }) => {
    const cookieHeader = request.headers.get("cookie") ?? "";
    return next({ context: { prefs: resolvePrefs(cookieHeader) } });
  },
);

const noBackendMiddleware = createMiddleware({
  type: "request",
}).server<WebAuthContext>(async ({ next, pathname }) => {
  if (!isServerPath(pathname)) {
    return next({ context: {} as WebAuthContext });
  }
  throw Response.json(
    { message: `Mock mode has no backend: ${pathname}` },
    { status: 501 },
  );
});

export function isServerPath(pathname: string) {
  return ServerPathPrefixes.some((prefix) => pathname.startsWith(prefix));
}

export const startInstance = createStart(() => ({
  requestMiddleware: [prefsMiddleware, noBackendMiddleware],
}));
