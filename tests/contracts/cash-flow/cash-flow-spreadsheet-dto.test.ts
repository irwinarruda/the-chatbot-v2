import { describe, expect, test } from "vitest";
import {
  CashFlowSpreadsheetPickerResponseDTO,
  ConnectCashFlowSpreadsheetRequestDTO,
} from "~/contracts/http/cash-flow/cash-flow-spreadsheet";

describe("Cash flow spreadsheet contracts", () => {
  test("accepts a picker with or without a linked spreadsheet", () => {
    const picker = { accessToken: "token", appId: "123", developerKey: "key" };

    expect(CashFlowSpreadsheetPickerResponseDTO.parse(picker)).toEqual(picker);
    expect(
      CashFlowSpreadsheetPickerResponseDTO.parse({
        ...picker,
        spreadsheetId: "sheet",
      }).spreadsheetId,
    ).toBe("sheet");
  });

  test("rejects a picker without a Google token", () => {
    expect(() =>
      CashFlowSpreadsheetPickerResponseDTO.parse({
        accessToken: "",
        appId: "123",
        developerKey: "key",
      }),
    ).toThrow();
  });

  test("requires the spreadsheet url to connect", () => {
    expect(
      ConnectCashFlowSpreadsheetRequestDTO.parse({
        url: " https://docs.google.com/spreadsheets/d/sheet/edit ",
      }).url,
    ).toBe("https://docs.google.com/spreadsheets/d/sheet/edit");
    expect(() =>
      ConnectCashFlowSpreadsheetRequestDTO.parse({ url: " " }),
    ).toThrow();
  });
});
