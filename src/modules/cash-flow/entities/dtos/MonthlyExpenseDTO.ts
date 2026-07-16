import { z } from "zod";

export const MonthlyExpenseMonthDTO = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export type MonthlyExpenseMonthDTO = z.infer<typeof MonthlyExpenseMonthDTO>;

export const MonthlyExpenseResponseDTO = z.object({
  id: z.string().uuid(),
  name: z.string(),
  expectedAmount: z.number().positive().optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  month: MonthlyExpenseMonthDTO,
  isPaid: z.boolean(),
  paidAt: z.iso.datetime().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type MonthlyExpenseResponseDTO = z.infer<
  typeof MonthlyExpenseResponseDTO
>;
export type MonthlyExpenseDTO = MonthlyExpenseResponseDTO;

export const MonthlyExpensesResponseDTO = z.object({
  month: MonthlyExpenseMonthDTO,
  expenses: z.array(MonthlyExpenseResponseDTO),
});
export type MonthlyExpensesResponseDTO = z.infer<
  typeof MonthlyExpensesResponseDTO
>;

export const MonthlyExpenseItemResponseDTO = z.object({
  expense: MonthlyExpenseResponseDTO,
});
export type MonthlyExpenseItemResponseDTO = z.infer<
  typeof MonthlyExpenseItemResponseDTO
>;

export const CreateMonthlyExpenseRequestDTO = z.object({
  name: z.string().trim().min(1).max(160),
  expectedAmount: z.number().finite().positive().optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  month: MonthlyExpenseMonthDTO.optional(),
});
export type CreateMonthlyExpenseRequestDTO = z.infer<
  typeof CreateMonthlyExpenseRequestDTO
>;

export const UpdateMonthlyExpenseRequestDTO = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  expectedAmount: z.number().finite().positive().nullable().optional(),
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
  month: MonthlyExpenseMonthDTO.optional(),
});
export type UpdateMonthlyExpenseRequestDTO = z.infer<
  typeof UpdateMonthlyExpenseRequestDTO
>;

export const SetMonthlyExpensePaidRequestDTO = z.object({
  isPaid: z.boolean(),
  month: MonthlyExpenseMonthDTO.optional(),
});
export type SetMonthlyExpensePaidRequestDTO = z.infer<
  typeof SetMonthlyExpensePaidRequestDTO
>;
