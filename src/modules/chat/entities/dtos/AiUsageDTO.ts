import { z } from "zod";

export const AiUsageDTO = z.object({
  input: z.number().nonnegative(),
  output: z.number().nonnegative(),
  cacheRead: z.number().nonnegative(),
  cacheWrite: z.number().nonnegative(),
  cacheWrite1h: z.number().nonnegative().optional(),
  reasoning: z.number().nonnegative().optional(),
  totalTokens: z.number().nonnegative(),
  cost: z.object({
    input: z.number().nonnegative(),
    output: z.number().nonnegative(),
    cacheRead: z.number().nonnegative(),
    cacheWrite: z.number().nonnegative(),
    total: z.number().nonnegative(),
  }),
});

export type AiUsageDTO = z.infer<typeof AiUsageDTO>;
