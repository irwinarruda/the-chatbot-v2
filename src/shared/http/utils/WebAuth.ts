import { ServerBootstrap } from "~/infra/server-bootstrap";
import type { WebAuthTokenPayloadDTO } from "~/modules/identity/entities/dtos/IdentityDTO";
import { getWebAuthToken } from "~/shared/http/utils/WebAuthCookie";

export interface WebAuthContext {
  webAuth: WebAuthTokenPayloadDTO;
}

export class WebAuth {
  static async requireAuth(request: Request): Promise<WebAuthTokenPayloadDTO> {
    const authService = ServerBootstrap.getApplication().services.auth;
    const user = await authService.authenticateWebUser(
      getWebAuthToken(request) ?? "",
    );
    return {
      userId: user.id,
      email: user.email ?? "",
      phoneNumber: user.phoneNumber,
      purpose: "web-auth",
    };
  }
}
