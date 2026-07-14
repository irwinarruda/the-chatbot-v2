import { z } from "zod";

export const AddTransactionToolDTO = z.object({
  type: z
    .enum(["Expense", "Earning"])
    .describe("Transaction type: Expense or Earning"),
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
    .describe("Monetary value (positive number)"),
  date: z.iso
    .date()
    .describe("ISO-8601 date (if not explicit, omit this field)")
    .optional(),
});

export type AddTransactionToolDTO = z.infer<typeof AddTransactionToolDTO>;
