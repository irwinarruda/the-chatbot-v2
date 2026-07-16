import type {
  AuthGateway,
  GoogleTokensDTO,
  GoogleUserInfoDTO,
} from "~/modules/identity/gateway/AuthGateway";
import { buildScopes } from "~/modules/identity/gateway/AuthGateway/GoogleAuthScopes";
import type { GoogleConfig } from "~/shared/config/Config";
import { DeveloperException } from "~/shared/errors/ApplicationErrors";

export class TestAuthGateway implements AuthGateway {
  private googleConfig: GoogleConfig;

  constructor(googleConfig: GoogleConfig) {
    this.googleConfig = googleConfig;
  }

  getAppLoginUrl(id: string): string {
    const url = new URL(this.googleConfig.loginUri);
    url.searchParams.set("id", id);
    return url.toString();
  }

  createAuthorizationCodeUrl(
    state?: string,
    redirectTarget: "app" | "web" = "app",
  ): string {
    const scopes = buildScopes();
    const redirectUri =
      redirectTarget === "web"
        ? this.googleConfig.webRedirectUri || this.googleConfig.redirectUri
        : this.googleConfig.redirectUri;
    const params = new URLSearchParams({
      client_id: this.googleConfig.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes.join(" "),
      access_type: "offline",
      prompt: "consent",
    });
    if (state) {
      params.set("state", state);
    }
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForTokens(
    code: string,
    _redirectTarget: "app" | "web" = "app",
  ): Promise<GoogleTokensDTO> {
    if (code !== "rightCode") {
      throw new DeveloperException(
        "[exchangeCodeForTokens]",
        "Wrong code testing variable!",
      );
    }
    return {
      accessToken: "ya29.a0ARrdaM9test_access_token_123456789",
      refreshToken: "1//0G_refresh_token_test_abcdefghijklmnopqrstuvwxyz",
      expiresInSeconds: 3600,
    };
  }

  async getUserInfo(_accessToken: string): Promise<GoogleUserInfoDTO> {
    return {
      email: "savegooglecredentials@example.com",
      name: "Save Google Credentials User",
    };
  }

  async refreshToken(
    accessToken: string,
    refreshToken: string,
  ): Promise<GoogleTokensDTO> {
    if (accessToken !== "ya29.a0ARrdaM9test_access_token_123456789") {
      throw new DeveloperException("[refreshToken]", "Wrong accessToken");
    }
    if (
      refreshToken !== "1//0G_refresh_token_test_abcdefghijklmnopqrstuvwxyz"
    ) {
      throw new DeveloperException("[refreshToken]", "Wrong refreshToken");
    }
    return {
      accessToken: "ya29.a0ARrdaM9refreshed_access_token_123456789",
      refreshToken: "1//0G_refresh_token_refreshed_abcdefghijklmnopqrstuvwxyz",
      expiresInSeconds: 3600,
    };
  }
}
