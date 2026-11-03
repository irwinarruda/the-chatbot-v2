import { z } from "zod";

export const GetLatestTransactionsToolDTO = z.object({
  limit: z
    .number()
    .int()
    .positive()
    .describe(
      "Optional number of most recent transactions to return. Omit to return the full history. There is no maximum.",
    )
    .optional(),
});

export type GetLatestTransactionsToolDTO = z.infer<
  typeof GetLatestTransactionsToolDTO
>;
