import { createMiddleware } from "@tanstack/react-start";
import { prefsService } from "~/client/services/prefsService";

export const prefsMiddleware = createMiddleware({
  type: "request",
}).server(async ({ next, request }) => {
  const cookieHeader = request.headers.get("cookie") ?? "";
  return next({
    context: {
      prefs: prefsService.resolvePrefs(cookieHeader),
    },
  });
});
