import type { CashFlowSpreadsheetPickerResponseDTO } from "~/contracts/http/cash-flow/cash-flow-spreadsheet";

export interface SpreadsheetPickerGateway {
  pickSpreadsheet(
    picker: CashFlowSpreadsheetPickerResponseDTO,
  ): Promise<string | undefined>;
}
