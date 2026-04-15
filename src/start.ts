import { createMiddleware, createStart } from "@tanstack/react-start";
import { createApiErrorResponse } from "~/infra/exceptions";
import { ServerBootstrap } from "~/infra/server-bootstrap";

const securityHeadersMiddleware = createMiddleware({
  type: "request",
}).server(async ({ next }) => {
  const response = await next();
  if (response instanceof Response) {
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set("X-XSS-Protection", "1; mode=block");
    response.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; frame-ancestors 'none'",
    );
  }
  return response;
});

const apiExceptionMiddleware = createMiddleware({ type: "request" }).server(
  async ({ next, pathname }) => {
    const isApi = pathname.startsWith("/api/");
    if (isApi) {
      await ServerBootstrap.ensureBootstrapped();
    }
    try {
      const response = await next();
      return response;
    } catch (error) {
      if (!isApi) {
        throw error;
      }
      return createApiErrorResponse(error);
    }
  },
);

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeadersMiddleware, apiExceptionMiddleware],
}));
