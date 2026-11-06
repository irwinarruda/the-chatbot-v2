import { formatCashFlowDate } from "~/domain/cash-flow/cash-flow-date";
export type BillsSearch = {
  month?: string;
};

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const monthFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
});

export function getCurrentBillsMonth(now = new Date()): string {
  return monthFormatter.format(now).slice(0, 7);
}

export function normalizeBillsSearch(
  search: Record<string, unknown>,
): BillsSearch {
  if (typeof search.month !== "string") return {};
  const currentMonth = getCurrentBillsMonth();
  if (!MONTH_PATTERN.test(search.month) || search.month >= currentMonth) {
    return {};
  }
  return { month: search.month };
}

export function toBillsRouteSearch(month: string): BillsSearch {
  if (month === getCurrentBillsMonth()) return {};
  return { month };
}

export function shiftBillsMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return date.toISOString().slice(0, 7);
}

export function getBillDaysUntilDue(
  bill: { dueDay?: number; isPaid: boolean; month: string },
  now: Date,
): number | undefined {
  const today = formatCashFlowDate(now);
  if (bill.isPaid || !bill.dueDay || bill.month !== today.slice(0, 7))
    return undefined;
  return bill.dueDay - Number(today.slice(8, 10));
}

export function compareBillsByUrgency(
  first: { dueDay?: number; isPaid: boolean },
  second: { dueDay?: number; isPaid: boolean },
): number {
  if (first.isPaid !== second.isPaid) return first.isPaid ? 1 : -1;
  return (first.dueDay ?? 32) - (second.dueDay ?? 32);
}
