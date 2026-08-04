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

export function normalizeCashFlowSearch(
  search: Record<string, unknown>,
): CashFlowSearch {
  const type = search.type;
  return {
    q: typeof search.q === "string" ? search.q : undefined,
    type:
      type === CashFlowTransactionType.Expense ||
      type === CashFlowTransactionType.Earning ||
      type === "all"
        ? type
        : "all",
    bankAccount:
      typeof search.bankAccount === "string" ? search.bankAccount : undefined,
    category: typeof search.category === "string" ? search.category : undefined,
    from: isDate(search.from) ? search.from : undefined,
    to: isDate(search.to) ? search.to : undefined,
  };
}

export function toCashFlowRouteSearch(
  filters: CashFlowFilterValues,
): CashFlowSearch {
  return {
    q: filters.q || undefined,
    type: filters.type === "all" ? undefined : filters.type,
    bankAccount: filters.bankAccount || undefined,
    category: filters.category || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
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
