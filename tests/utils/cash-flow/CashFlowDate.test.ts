import { afterEach, describe, expect, test, vi } from "vitest";
import {
  formatCashFlowDate,
  formatCashFlowSpreadsheetDate,
  getCashFlowMonth,
  parseCashFlowSpreadsheetDate,
} from "~/modules/cash-flow/utils/CashFlowDate";

afterEach(() => {
  vi.useRealTimers();
});

describe("CashFlowDate", () => {
  test("preserves spreadsheet calendar dates as noon UTC", () => {
    expect(parseCashFlowSpreadsheetDate("02/07/2026").toISOString()).toBe(
      "2026-07-02T12:00:00.000Z",
    );
  });

  test("resolves dates and months in Sao Paulo at UTC boundaries", () => {
    const monthBoundary = new Date("2026-09-01T00:30:00.000Z");
    const yearBoundary = new Date("2027-01-01T00:30:00.000Z");

    expect(formatCashFlowDate(monthBoundary)).toBe("2026-08-31");
    expect(formatCashFlowSpreadsheetDate(monthBoundary)).toBe("31/08/2026");
    expect(getCashFlowMonth(monthBoundary)).toEqual({
      year: 2026,
      monthIndex: 7,
    });
    expect(getCashFlowMonth(yearBoundary)).toEqual({
      year: 2026,
      monthIndex: 11,
    });
  });

  test("falls back to the current date for malformed spreadsheet values", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-04T12:00:00.000Z"));

    expect(parseCashFlowSpreadsheetDate("invalid").toISOString()).toBe(
      "2026-07-04T12:00:00.000Z",
    );
  });
});
