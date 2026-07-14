export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number | undefined;
}

export interface GoogleUserInfo {
  name: string;
  email: string;
}

export interface AuthGateway {
  getAppLoginUrl(id: string): string;
  createAuthorizationCodeUrl(
    state?: string,
    redirectTarget?: "app" | "web",
  ): string;
  exchangeCodeForTokens(
    code: string,
    redirectTarget?: "app" | "web",
  ): Promise<GoogleTokens>;
  getUserInfo(accessToken: string): Promise<GoogleUserInfo>;
  refreshToken(
    accessToken: string,
    refreshToken: string,
  ): Promise<GoogleTokens>;
}
