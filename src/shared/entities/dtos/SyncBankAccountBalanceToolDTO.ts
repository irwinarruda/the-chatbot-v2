import { z } from "zod";

export const SyncBankAccountBalanceToolDTO = z.object({
  user_message: z
    .string()
    .min(1)
    .describe(
      "Full original user message text with all context and nuances; pass exactly what the user sent",
    ),
  current_balance: z
    .number()
    .finite()
    .describe(
      "The real current balance of the bank account as reported by the user",
    ),
  date: z.iso
    .date()
    .describe("Optional ISO-8601 date (if not explicit, omit this field)")
    .optional(),
});

export type SyncBankAccountBalanceToolDTO = z.infer<
  typeof SyncBankAccountBalanceToolDTO
>;
