import { CashFlowSpreadsheet } from "~/domain/cash-flow/cash-flow-spreadsheet";
import { CashFlowSpreadsheetType } from "~/domain/cash-flow/cash-flow-spreadsheet-type";

describe("CashFlowSpreadsheet", () => {
  test("serializes spreadsheet ownership", () => {
    const spreadsheet = new CashFlowSpreadsheet();
    spreadsheet.idUser = "user-1";
    spreadsheet.idSheet = "sheet-1";
    spreadsheet.type = CashFlowSpreadsheetType.Google;
    expect(spreadsheet.toJSON()).toMatchObject({
      idUser: "user-1",
      idSheet: "sheet-1",
      type: "google",
    });
  });
});
