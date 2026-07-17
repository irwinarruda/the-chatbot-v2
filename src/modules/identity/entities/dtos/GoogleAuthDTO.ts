import { z } from "zod";

export const StartAppGoogleLoginRequestDTO = z.object({
  challenge: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
});

export type StartAppGoogleLoginRequestDTO = z.infer<
  typeof StartAppGoogleLoginRequestDTO
>;
