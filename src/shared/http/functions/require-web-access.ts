import { createServerFn } from "@tanstack/react-start";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { UnauthorizedException } from "~/shared/errors/ApplicationErrors";
import { getWebAuthToken } from "~/shared/http/utils/WebAuthCookie";

export const requireWebAccess = createServerFn({ method: "GET" }).handler(
  async ({ request }: any) => {
    const authService = ServerBootstrap.getApplication().services.auth;
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
