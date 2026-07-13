import { z } from "zod";

export const TransferBetweenBankAccountsToolDTO = z.object({
  user_message: z
    .string()
    .min(1)
    .describe(
      "Full original user message text with all context and nuances; pass exactly what the user sent",
    ),
  value: z
    .number()
    .finite()
    .positive()
    .describe("Amount to transfer (positive number)"),
  date: z.iso
    .date()
    .describe("Optional ISO-8601 date (if not explicit, omit this field)")
    .optional(),
});

export type TransferBetweenBankAccountsToolDTO = z.infer<
  typeof TransferBetweenBankAccountsToolDTO
>;
