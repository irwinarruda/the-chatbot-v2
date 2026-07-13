import { z } from "zod";

export const GetBankAccountsStatusToolDTO = z.object({
  date: z.iso
    .date()
    .describe("Optional ISO-8601 date for the target month")
    .optional(),
});

export type GetBankAccountsStatusToolDTO = z.infer<
  typeof GetBankAccountsStatusToolDTO
>;
