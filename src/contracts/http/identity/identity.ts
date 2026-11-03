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
  purpose: "web-auth";
}
