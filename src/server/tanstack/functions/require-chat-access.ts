import { createServerFn } from "@tanstack/react-start";
import { Cookie } from "~/infra/cookie";
import { UnauthorizedException } from "~/infra/exceptions";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import type { AuthService } from "~/server/services/AuthService";

export const requireChatAccess = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const authService = ServerBootstrap.getService<AuthService>("AuthService");
    const cookieHeader = getRequestHeader("cookie") ?? "";
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
