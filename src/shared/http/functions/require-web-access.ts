import { createServerFn } from "@tanstack/react-start";
import { Cookie } from "~/infra/cookie";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { UnauthorizedException } from "~/shared/errors/ApplicationErrors";

export const requireWebAccess = createServerFn({ method: "GET" }).handler(
  async ({ request }: any) => {
    const authService = ServerBootstrap.getApplication().services.auth;
    const cookieHeader = request.headers.get("cookie") ?? "";
    const token = Cookie.get(cookieHeader, "web_auth_token") ?? "";
    try {
      await authService.authenticateWebUser(token);
      return { ok: true as const };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        return { ok: false as const };
      }
      throw error;
    }
  },
);
