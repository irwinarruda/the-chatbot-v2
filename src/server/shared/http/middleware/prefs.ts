import { createMiddleware } from "@tanstack/react-start";
import { resolvePrefs } from "~/contracts/http/shared/prefs-cookie";

export const prefsMiddleware = createMiddleware({
  type: "request",
}).server(async ({ next, request }) => {
  const cookieHeader = request.headers.get("cookie") ?? "";
  return next({
    context: {
      prefs: resolvePrefs(cookieHeader),
    },
  });
});
