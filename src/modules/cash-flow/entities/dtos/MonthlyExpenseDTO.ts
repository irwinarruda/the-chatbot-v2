import { z } from "zod";

export const MonthlyExpenseMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export type MonthlyExpenseMonth = z.infer<typeof MonthlyExpenseMonth>;

export const MonthlyExpenseResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
  expectedAmount: z.number().positive().optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  month: MonthlyExpenseMonth,
  isPaid: z.boolean(),
  paidAt: z.iso.datetime().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type MonthlyExpenseResponse = z.infer<typeof MonthlyExpenseResponse>;
export type MonthlyExpense = MonthlyExpenseResponse;

export const MonthlyExpensesResponse = z.object({
  month: MonthlyExpenseMonth,
  expenses: z.array(MonthlyExpenseResponse),
});
export type MonthlyExpensesResponse = z.infer<typeof MonthlyExpensesResponse>;

export const MonthlyExpenseItemResponse = z.object({
  expense: MonthlyExpenseResponse,
});
export type MonthlyExpenseItemResponse = z.infer<
  typeof MonthlyExpenseItemResponse
>;

export const CreateMonthlyExpenseRequest = z.object({
  name: z.string().trim().min(1).max(160),
  expectedAmount: z.number().finite().positive().optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  month: MonthlyExpenseMonth.optional(),
});
export type CreateMonthlyExpenseRequest = z.infer<
  typeof CreateMonthlyExpenseRequest
>;

export const UpdateMonthlyExpenseRequest = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  expectedAmount: z.number().finite().positive().nullable().optional(),
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
  month: MonthlyExpenseMonth.optional(),
});
export type UpdateMonthlyExpenseRequest = z.infer<
  typeof UpdateMonthlyExpenseRequest
>;

export const SetMonthlyExpensePaidRequest = z.object({
  isPaid: z.boolean(),
  month: MonthlyExpenseMonth.optional(),
});
export type SetMonthlyExpensePaidRequest = z.infer<
  typeof SetMonthlyExpensePaidRequest
>;
