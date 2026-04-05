import type { GoogleConfig } from "~/infra/config";
import { DeveloperException } from "~/infra/exceptions";
import { buildScopes } from "~/resources/GoogleAuthScopes";
import type {
  GoogleTokens,
  GoogleUserInfo,
  IGoogleAuthGateway,
} from "~/resources/IGoogleAuthGateway";

export class TestGoogleAuthGateway implements IGoogleAuthGateway {
  private googleConfig: GoogleConfig;

  constructor(googleConfig: GoogleConfig) {
    this.googleConfig = googleConfig;
  }

  createAuthorizationCodeUrl(state?: string): string {
    const scopes = buildScopes();
    const params = new URLSearchParams({
      client_id: this.googleConfig.clientId,
      redirect_uri: this.googleConfig.redirectUri,
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

  async exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
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

  async getUserInfo(_accessToken: string): Promise<GoogleUserInfo> {
    return {
      email: "savegooglecredentials@example.com",
      name: "Save Google Credentials User",
    };
  }

  async refreshToken(
    accessToken: string,
    refreshToken: string,
  ): Promise<GoogleTokens> {
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

  getAppLoginUrl(phoneNumber: string): string {
    const url = new URL(this.googleConfig.loginUri);
    url.searchParams.set("phone_number", phoneNumber);
    return url.toString();
  }
}
