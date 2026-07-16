export interface GoogleTokensDTO {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number | undefined;
}

export interface GoogleUserInfoDTO {
  name: string;
  email: string;
}
