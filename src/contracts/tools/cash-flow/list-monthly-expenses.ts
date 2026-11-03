import { z } from "zod";

export const ListMonthlyExpensesToolDTO = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .describe("Calendar month in YYYY-MM format; omit for the current month")
    .optional(),
  status: z.enum(["All", "Paid", "Unpaid"]).optional(),
});

export type ListMonthlyExpensesToolDTO = z.infer<
  typeof ListMonthlyExpensesToolDTO
>;
