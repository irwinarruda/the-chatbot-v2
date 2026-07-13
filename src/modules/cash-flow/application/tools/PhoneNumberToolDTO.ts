import { z } from "zod";

export const PhoneNumberToolDTO = z.object({});

export type PhoneNumberToolDTO = z.infer<typeof PhoneNumberToolDTO>;
