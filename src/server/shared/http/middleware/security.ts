import { createMiddleware } from "@tanstack/react-start";
import { getServer } from "~/server/production";
import { applySecurityHeaders } from "~/server/shared/http/utils/security-headers";

export const securityMiddleware = createMiddleware({
  type: "request",
}).server(async ({ next }) => {
  const result = await next();
  const { publicUrl } = getServer().config.r2;
  applySecurityHeaders(result.response.headers, publicUrl);
  return result;
});
