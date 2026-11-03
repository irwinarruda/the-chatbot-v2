const cashFlowDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatCashFlowDate(date: Date): string {
  return cashFlowDateFormatter.format(date);
}

export function formatCashFlowSpreadsheetDate(date: Date): string {
  const [year, month, day] = formatCashFlowDate(date).split("-");
  return `${day}/${month}/${year}`;
}

export function parseCashFlowSpreadsheetDate(value: string): Date {
  const parts = value.split("/");
  if (parts.length !== 3) return new Date();
  const [day, month, year] = parts.map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function getCashFlowMonth(date: Date): {
  year: number;
  monthIndex: number;
} {
  const [year, month] = formatCashFlowDate(date).split("-").map(Number);
  return { year, monthIndex: month - 1 };
}
