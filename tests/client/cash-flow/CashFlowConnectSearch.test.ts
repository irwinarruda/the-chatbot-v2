import { describe, expect, test } from "vitest";
import { normalizeCashFlowConnectSearch } from "~/client/modules/cash-flow/parsers/CashFlowConnectSearch";

describe("normalizeCashFlowConnectSearch", () => {
  test("keeps the spreadsheet the link asks to connect", () => {
    expect(
      normalizeCashFlowConnectSearch({ spreadsheet: "sheet-id", other: "x" }),
    ).toEqual({ spreadsheet: "sheet-id" });
  });

  test("drops a missing or malformed spreadsheet", () => {
    expect(normalizeCashFlowConnectSearch({})).toEqual({});
    expect(normalizeCashFlowConnectSearch({ spreadsheet: "" })).toEqual({});
    expect(normalizeCashFlowConnectSearch({ spreadsheet: 12 })).toEqual({});
  });
});
