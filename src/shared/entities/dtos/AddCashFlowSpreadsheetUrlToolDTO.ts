import { z } from "zod";

export const AddCashFlowSpreadsheetUrlToolDTO = z.object({
  url: z.string().min(1).describe("Google Spreadsheet URL"),
});

export type AddCashFlowSpreadsheetUrlToolDTO = z.infer<
  typeof AddCashFlowSpreadsheetUrlToolDTO
>;
