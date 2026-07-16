import { z } from "zod";

export const CurrentUserResponseDTO = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email().optional(),
  phoneNumber: z.string(),
  bsuid: z.string().optional(),
});

export type CurrentUserResponseDTO = z.infer<typeof CurrentUserResponseDTO>;
export type CurrentUserDTO = CurrentUserResponseDTO;

export interface WebAuthTokenPayloadDTO {
  userId: string;
  email: string;
  phoneNumber?: string;
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

export type GoogleRedirectResultDTO = { type: "success" };

export type WebGoogleRedirectResultDTO = string;
