import { google } from "googleapis";
import type {
  AuthGateway,
  GoogleTokensDTO,
  GoogleUserInfoDTO,
} from "~/modules/identity/gateway/AuthGateway";
import { buildScopes } from "~/modules/identity/gateway/AuthGateway/GoogleAuthScopes";
import type { GoogleConfig } from "~/shared/config/Config";

export class GoogleAuthGateway implements AuthGateway {
  private loginUri: string;
  private oauth2Client: InstanceType<typeof google.auth.OAuth2>;
  private webOAuth2Client: InstanceType<typeof google.auth.OAuth2>;

  constructor(config: GoogleConfig) {
    this.loginUri = config.loginUri;
    this.oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.secretClientKey,
      config.redirectUri,
    );
    this.webOAuth2Client = new google.auth.OAuth2(
      config.clientId,
      config.secretClientKey,
      config.webRedirectUri || config.redirectUri,
    );
  }

  getAppLoginUrl(challenge: string): string {
    return new URL(`/g/${challenge}`, this.loginUri).toString();
  }

  createAuthorizationCodeUrl(
    state?: string,
    redirectTarget: "app" | "web" = "app",
  ): string {
    const oauth2Client = this.getOAuth2Client(redirectTarget);
    return oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: buildScopes(),
      state: state ?? undefined,
    });
  }

  async exchangeCodeForTokens(
    code: string,
    redirectTarget: "app" | "web" = "app",
  ): Promise<GoogleTokensDTO> {
    const { tokens } =
      await this.getOAuth2Client(redirectTarget).getToken(code);
    if (!tokens.access_token) {
      throw new Error("Failed to obtain required tokens from Google");
    }
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? "",
      expiresInSeconds: tokens.expiry_date
        ? Math.floor((tokens.expiry_date - Date.now()) / 1000)
        : 3600,
    };
  }

  async getUserInfo(accessToken: string): Promise<GoogleUserInfoDTO> {
    this.oauth2Client.setCredentials({ access_token: accessToken });
    const oauth2 = google.oauth2({ version: "v2", auth: this.oauth2Client });
    const { data } = await oauth2.userinfo.get();
    if (!data.name || !data.email) {
      throw new Error("Failed to obtain user info from Google");
    }
    return { name: data.name, email: data.email };
  }

  async refreshToken(
    accessToken: string,
    refreshToken: string,
  ): Promise<GoogleTokensDTO> {
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    const { credentials } = await this.oauth2Client.refreshAccessToken();
    if (!credentials.access_token) {
      throw new Error("Failed to refresh access token from Google");
    }
    return {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token ?? refreshToken,
      expiresInSeconds: credentials.expiry_date
        ? Math.floor((credentials.expiry_date - Date.now()) / 1000)
        : 3600,
    };
  }

  private getOAuth2Client(redirectTarget: "app" | "web") {
    return redirectTarget === "web" ? this.webOAuth2Client : this.oauth2Client;
  }
}
