import { Cookie } from "~/infra/cookie";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import type { AuthService, WebAuthTokenPayload } from "~/services/AuthService";

export class WebAuth {
  static async requireAuth(request: Request): Promise<WebAuthTokenPayload> {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const token = Cookie.get(cookieHeader, "web_auth_token");
    const authService = ServerBootstrap.getService<AuthService>("AuthService");
    const user = await authService.authenticateWebUser(token ?? "");
    return {
      userId: user.id,
      email: user.email ?? "",
      phoneNumber: user.phoneNumber,
    };
  }
}
