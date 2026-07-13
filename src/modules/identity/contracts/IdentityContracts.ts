import { z } from "zod";

export const CurrentUserResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email().optional(),
  phoneNumber: z.string(),
  bsuid: z.string().optional(),
});

export type CurrentUserResponse = z.infer<typeof CurrentUserResponse>;
export type CurrentUser = CurrentUserResponse;
