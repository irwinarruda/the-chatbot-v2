import { z } from "zod";

export const CashFlowSpreadsheetPickerResponseDTO = z.object({
  accessToken: z.string().min(1),
  appId: z.string(),
  developerKey: z.string(),
  spreadsheetId: z.string().optional(),
});
export type CashFlowSpreadsheetPickerResponseDTO = z.infer<
  typeof CashFlowSpreadsheetPickerResponseDTO
>;

export const ConnectCashFlowSpreadsheetRequestDTO = z.object({
  url: z.string().trim().min(1),
});
export type ConnectCashFlowSpreadsheetRequestDTO = z.infer<
  typeof ConnectCashFlowSpreadsheetRequestDTO
>;
