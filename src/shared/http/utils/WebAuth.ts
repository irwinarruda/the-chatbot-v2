import { Cookie } from "~/infra/cookie";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import type { WebAuthTokenPayloadDTO } from "~/modules/identity/entities/dtos/IdentityDTO";

export interface WebAuthContext {
  webAuth: WebAuthTokenPayloadDTO;
}

export class WebAuth {
  static async requireAuth(request: Request): Promise<WebAuthTokenPayloadDTO> {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const token = Cookie.get(cookieHeader, "web_auth_token");
    const authService = ServerBootstrap.getApplication().services.auth;
    const user = await authService.authenticateWebUser(token ?? "");
    return {
      userId: user.id,
      email: user.email ?? "",
      phoneNumber: user.phoneNumber,
    };
  }
}
