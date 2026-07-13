import { createMiddleware } from "@tanstack/react-start";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { createApiErrorResponse } from "~/shared/http/utils/ApiErrorResponse";

export const errorMiddleware = createMiddleware({
  type: "request",
}).server(async ({ next, pathname }) => {
  const isApi = pathname.startsWith("/api/");
  if (isApi) {
    await ServerBootstrap.ensureBootstrapped();
  }

  try {
    return await next();
  } catch (error) {
    if (!isApi) {
      throw error;
    }
    return createApiErrorResponse(error);
  }
});
