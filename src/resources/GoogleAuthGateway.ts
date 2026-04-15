import { google } from "googleapis";
import type { GoogleConfig } from "~/infra/config";
import { buildScopes } from "~/resources/GoogleAuthScopes";
import type {
  GoogleTokens,
  GoogleUserInfo,
  IGoogleAuthGateway,
} from "~/resources/IGoogleAuthGateway";

export class GoogleAuthGateway implements IGoogleAuthGateway {
  private oauth2Client: InstanceType<typeof google.auth.OAuth2>;
  private webOAuth2Client: InstanceType<typeof google.auth.OAuth2>;

  constructor(private config: GoogleConfig) {
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

  createAuthorizationCodeUrl(state?: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: buildScopes(),
      state: state ?? undefined,
    });
  }

  async exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
    const { tokens } = await this.oauth2Client.getToken(code);
    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error("Failed to obtain required tokens from Google");
    }
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresInSeconds: tokens.expiry_date
        ? Math.floor((tokens.expiry_date - Date.now()) / 1000)
        : 3600,
    };
  }

  async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
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
  ): Promise<GoogleTokens> {
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

  getAppLoginUrl(phoneNumber: string): string {
    const url = new URL(this.config.loginUri);
    url.searchParams.set("phone_number", phoneNumber);
    return url.toString();
  }

  getWebPostLoginRedirect(): string {
    return this.config.webLoginUri;
  }

  createWebAuthorizationCodeUrl(): string {
    return this.webOAuth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: buildScopes(),
    });
  }

  async exchangeWebCodeForTokens(code: string): Promise<GoogleTokens> {
    const { tokens } = await this.webOAuth2Client.getToken(code);
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
}
