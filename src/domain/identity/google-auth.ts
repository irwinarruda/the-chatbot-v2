export interface GoogleTokensDTO {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number | undefined;
}

export interface GoogleUserInfoDTO {
  name: string;
  email: string;
}

export interface SyncUserChatAddressesDTO {
  idUser: string;
  email?: string;
  phoneNumber?: string;
  bsuid?: string;
}

export type GoogleLoginResultDTO =
  | { type: "redirect"; url: string }
  | { type: "alreadySignedIn" };

export type WebGoogleLoginResultDTO = { type: "redirect"; url: string };
