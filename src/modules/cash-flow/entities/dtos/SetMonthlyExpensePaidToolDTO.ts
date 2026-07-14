import { z } from "zod";

export const SetMonthlyExpensePaidToolDTO = z.object({
  expense_id: z
    .string()
    .uuid()
    .describe("ID returned by list_monthly_expenses"),
  is_paid: z.boolean().describe("True to mark paid; false to mark unpaid"),
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .describe("Calendar month in YYYY-MM format; omit for the current month")
    .optional(),
});

export type SetMonthlyExpensePaidToolDTO = z.infer<
  typeof SetMonthlyExpensePaidToolDTO
>;
