import { createMiddleware } from "@tanstack/react-start";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { applySecurityHeaders } from "~/shared/http/utils/SecurityHeaders";

export const securityMiddleware = createMiddleware({
  type: "request",
}).server(async ({ next }) => {
  const result = await next();
  const { publicUrl } = ServerBootstrap.getApplication().config.r2;
  applySecurityHeaders(result.response.headers, publicUrl);
  return result;
});
