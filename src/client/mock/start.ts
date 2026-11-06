import { createMiddleware, createStart } from "@tanstack/react-start";
import { resolvePrefs } from "~/contracts/http/shared/prefs-cookie";

const prefsMiddleware = createMiddleware({ type: "request" }).server(
  async ({ next, request }) => {
    const cookieHeader = request.headers.get("cookie") ?? "";
    return next({ context: { prefs: resolvePrefs(cookieHeader) } });
  },
);

const noBackendMiddleware = createMiddleware({ type: "request" }).server(
  async ({ next, pathname }) => {
    if (!pathname.startsWith("/api/")) return next();
    throw Response.json(
      { message: `Mock mode has no backend: ${pathname}` },
      { status: 501 },
    );
  },
);

export const startInstance = createStart(() => ({
  requestMiddleware: [prefsMiddleware, noBackendMiddleware],
}));
