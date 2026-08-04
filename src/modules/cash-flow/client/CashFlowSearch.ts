import type { CashFlowTransactionResponseDTO } from "~/modules/cash-flow/entities/dtos/CashFlowWebDTO";
import { CashFlowTransactionType } from "~/modules/cash-flow/entities/enums/CashFlowTransactionType";

export type CashFlowSearch = {
  q?: string;
  type?: "all" | CashFlowTransactionType;
  bankAccount?: string;
  category?: string;
  from?: string;
  to?: string;
};

export interface CashFlowFilterValues {
  q: string;
  type: "all" | CashFlowTransactionType;
  bankAccount: string;
  category: string;
  from: string;
  to: string;
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value;
}

function normalizeTransactionType(value: unknown): CashFlowSearch["type"] {
  if (value === CashFlowTransactionType.Expense) return value;
  if (value === CashFlowTransactionType.Earning) return value;
  if (value === "all") return value;
  return "all";
}

function optionalFilterValue(value: string): string | undefined {
  if (!value) return undefined;
  return value;
}

export function normalizeCashFlowSearch(
  search: Record<string, unknown>,
): CashFlowSearch {
  return {
    q: normalizeOptionalString(search.q),
    type: normalizeTransactionType(search.type),
    bankAccount: normalizeOptionalString(search.bankAccount),
    category: normalizeOptionalString(search.category),
    from: isDate(search.from) ? search.from : undefined,
    to: isDate(search.to) ? search.to : undefined,
  };
}

export function toCashFlowRouteSearch(
  filters: CashFlowFilterValues,
): CashFlowSearch {
  let type: CashFlowSearch["type"];
  if (filters.type !== "all") type = filters.type;
  return {
    q: optionalFilterValue(filters.q),
    type,
    bankAccount: optionalFilterValue(filters.bankAccount),
    category: optionalFilterValue(filters.category),
    from: optionalFilterValue(filters.from),
    to: optionalFilterValue(filters.to),
  };
}

export function filterCashFlowTransactions(
  transactions: CashFlowTransactionResponseDTO[],
  filters: CashFlowFilterValues,
): CashFlowTransactionResponseDTO[] {
  const query = filters.q.trim().toLocaleLowerCase();
  return transactions
    .filter((transaction) => {
      const date = transaction.date.slice(0, 10);
      if (filters.type !== "all" && transaction.type !== filters.type) {
        return false;
      }
      if (
        filters.bankAccount &&
        transaction.bankAccount !== filters.bankAccount
      ) {
        return false;
      }
      if (filters.category && transaction.category !== filters.category) {
        return false;
      }
      if (filters.from && date < filters.from) return false;
      if (filters.to && date > filters.to) return false;
      if (!query) return true;
      return [
        transaction.description,
        transaction.category,
        transaction.bankAccount,
      ].some((value) => value.toLocaleLowerCase().includes(query));
    })
    .reverse();
}
