import { afterEach, describe, expect, test, vi } from "vitest";
import {
  normalizeBillsSearch,
  shiftBillsMonth,
  toBillsRouteSearch,
} from "~/modules/cash-flow/client/BillsSearch";

describe("BillsSearch", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("keeps prior months in the URL and normalizes current or future months", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T12:00:00.000Z"));

    expect(normalizeBillsSearch({ month: "2026-06" })).toEqual({
      month: "2026-06",
    });
    expect(normalizeBillsSearch({ month: "2026-07" })).toEqual({});
    expect(normalizeBillsSearch({ month: "2026-08" })).toEqual({});
    expect(toBillsRouteSearch("2026-07")).toEqual({});
  });

  test("moves across year boundaries", () => {
    expect(shiftBillsMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftBillsMonth("2026-12", 1)).toBe("2027-01");
  });
});
