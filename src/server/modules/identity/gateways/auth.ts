import type {
  GoogleTokensDTO,
  GoogleUserInfoDTO,
} from "~/domain/identity/google-auth";

export type {
  GoogleTokensDTO,
  GoogleUserInfoDTO,
} from "~/domain/identity/google-auth";

export interface AuthGateway {
  getAppLoginUrl(challenge: string): string;
  createAuthorizationCodeUrl(
    state?: string,
    redirectTarget?: "app" | "web",
  ): string;
  exchangeCodeForTokens(
    code: string,
    redirectTarget?: "app" | "web",
  ): Promise<GoogleTokensDTO>;
  getUserInfo(accessToken: string): Promise<GoogleUserInfoDTO>;
  refreshToken(
    accessToken: string,
    refreshToken: string,
  ): Promise<GoogleTokensDTO>;
}
