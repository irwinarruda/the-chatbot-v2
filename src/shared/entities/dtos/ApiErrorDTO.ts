import { z } from "zod";

export const ApiErrorResponse = z.object({
  message: z.string(),
  action: z.string(),
  name: z.string(),
  statusCode: z.number().int().min(400).max(599),
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponse>;
