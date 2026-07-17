import { createMiddleware } from "@tanstack/react-start";
import { ForbiddenException } from "~/shared/errors/ApplicationErrors";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const webRequestSecurityMiddleware = createMiddleware({
  type: "request",
}).server(async ({ next, request }) => {
  enforceWebRequestSecurity(request);
  return next();
});

export function enforceWebRequestSecurity(request: Request): void {
  const requestUrl = new URL(request.url);
  if (!requestUrl.pathname.startsWith("/api/v1/web/")) return;
  if (!UNSAFE_METHODS.has(request.method.toUpperCase())) return;

  const origin = parseOrigin(request.headers.get("origin"));
  if (origin !== requestUrl.origin) {
    throw createCrossSiteRequestError();
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite?.toLowerCase() === "cross-site") {
    throw createCrossSiteRequestError();
  }

  const referer = request.headers.get("referer");
  if (referer && parseOrigin(referer) !== requestUrl.origin) {
    throw createCrossSiteRequestError();
  }
}

function parseOrigin(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function createCrossSiteRequestError(): ForbiddenException {
  return new ForbiddenException(
    "Cross-site web requests are not allowed.",
    "Retry the action from this application.",
  );
}
