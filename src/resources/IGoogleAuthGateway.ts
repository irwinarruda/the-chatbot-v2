export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number | undefined;
}

export interface GoogleUserInfo {
  name: string;
  email: string;
}

export interface IGoogleAuthGateway {
  createAuthorizationCodeUrl(state?: string): string;
  exchangeCodeForTokens(code: string): Promise<GoogleTokens>;
  getUserInfo(accessToken: string): Promise<GoogleUserInfo>;
  refreshToken(
    accessToken: string,
    refreshToken: string,
  ): Promise<GoogleTokens>;
  getAppLoginUrl(phoneNumber: string): string;
  createWebAuthorizationCodeUrl(): string;
  exchangeWebCodeForTokens(code: string): Promise<GoogleTokens>;
}
