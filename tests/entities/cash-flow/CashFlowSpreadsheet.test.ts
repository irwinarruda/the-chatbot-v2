import { CashFlowSpreadsheet } from "~/modules/cash-flow/entities/CashFlowSpreadsheet";
import { CashFlowSpreadsheetType } from "~/modules/cash-flow/entities/enums/CashFlowSpreadsheetType";

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
