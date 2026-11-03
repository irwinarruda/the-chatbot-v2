import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getServer } from "~/server/production";
import { UnauthorizedException } from "~/server/shared/errors/application-errors";
import { getWebAuthToken } from "~/server/shared/http/utils/web-auth-cookie";

export const requireWebAccess = createServerFn({ method: "GET" }).handler(
  async () => {
    const request = getRequest();
    const authService = getServer().services.auth;
    try {
      await authService.authenticateWebUser(getWebAuthToken(request) ?? "");
      return { ok: true as const };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        return { ok: false as const };
      }
      throw error;
    }
  },
);
