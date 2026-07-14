import { z } from "zod";

export const GetLatestTransactionsToolDTO = z.object({
  limit: z
    .number()
    .describe(
      "Number of most recent transactions to return (default 10, max 50)",
    )
    .optional(),
});

export type GetLatestTransactionsToolDTO = z.infer<
  typeof GetLatestTransactionsToolDTO
>;
