import { z } from "zod";

export const CreateMonthlyExpenseToolDTO = z.object({
  name: z.string().trim().min(1).max(160).describe("Short bill name"),
  expected_amount: z
    .number()
    .finite()
    .positive()
    .describe("Expected monthly amount, when known")
    .optional(),
  due_day: z
    .number()
    .int()
    .min(1)
    .max(31)
    .describe("Day of the month when the bill is due, when known")
    .optional(),
});

export type CreateMonthlyExpenseToolDTO = z.infer<
  typeof CreateMonthlyExpenseToolDTO
>;
