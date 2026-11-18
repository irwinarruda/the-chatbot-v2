export type CashFlowConnectSearch = {
  spreadsheet?: string;
};

export function normalizeCashFlowConnectSearch(
  search: Record<string, unknown>,
): CashFlowConnectSearch {
  const { spreadsheet } = search;
  if (typeof spreadsheet !== "string" || !spreadsheet) return {};
  return { spreadsheet };
}
