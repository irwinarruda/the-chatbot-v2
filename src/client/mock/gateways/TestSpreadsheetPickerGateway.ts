import type { SpreadsheetPickerGateway } from "~/client/modules/cash-flow/app/gateways/SpreadsheetPickerGateway";

export class TestSpreadsheetPickerGateway implements SpreadsheetPickerGateway {
  async pickSpreadsheet() {
    return "https://docs.google.com/spreadsheets/d/demo-spreadsheet/edit";
  }
}
