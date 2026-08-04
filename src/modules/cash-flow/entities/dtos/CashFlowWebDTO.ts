import { z } from "zod";
import { CashFlowTransactionType } from "~/modules/cash-flow/entities/enums/CashFlowTransactionType";

export const CashFlowTransactionResponseDTO = z.object({
  position: z.number().int().nonnegative(),
  date: z.iso.datetime(),
  value: z.number().finite(),
  type: z.enum(CashFlowTransactionType),
  category: z.string(),
  description: z.string(),
  bankAccount: z.string(),
  isLast: z.boolean(),
});

export type CashFlowTransactionResponseDTO = z.infer<
  typeof CashFlowTransactionResponseDTO
>;

export const CashFlowBankAccountStatusResponseDTO = z.object({
  bankAccount: z.string(),
  balance: z.number().finite(),
});

export type CashFlowBankAccountStatusResponseDTO = z.infer<
  typeof CashFlowBankAccountStatusResponseDTO
>;

export const CashFlowDashboardResponseDTO = z.object({
  transactions: z.array(CashFlowTransactionResponseDTO),
  bankAccounts: z.array(z.string()),
  expenseCategories: z.array(z.string()),
  earningCategories: z.array(z.string()),
  bankAccountStatuses: z.array(CashFlowBankAccountStatusResponseDTO),
});

export type CashFlowDashboardResponseDTO = z.infer<
  typeof CashFlowDashboardResponseDTO
>;

export const CreateCashFlowTransactionRequestDTO = z.object({
  type: z.enum(CashFlowTransactionType),
  date: z.iso.date(),
  value: z.number().finite().positive(),
  category: z.string().trim().min(1),
  description: z.string().trim().min(1),
  bankAccount: z.string().trim().min(1),
});

export type CreateCashFlowTransactionRequestDTO = z.infer<
  typeof CreateCashFlowTransactionRequestDTO
>;

export const SyncCashFlowBankAccountRequestDTO = z.object({
  date: z.iso.date(),
  currentBalance: z.number().finite(),
  category: z.string().trim().min(1),
  description: z.string().trim().min(1),
  bankAccount: z.string().trim().min(1),
});

export type SyncCashFlowBankAccountRequestDTO = z.infer<
  typeof SyncCashFlowBankAccountRequestDTO
>;
