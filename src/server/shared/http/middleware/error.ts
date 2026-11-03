import { createMiddleware } from "@tanstack/react-start";
import { getServer } from "~/server/production";
import { createApiErrorResponse } from "~/server/shared/http/utils/api-error-response";

export const errorMiddleware = createMiddleware({
  type: "request",
}).server(async ({ next, pathname }) => {
  const isApi = pathname.startsWith("/api/");
  if (isApi) {
    getServer();
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
