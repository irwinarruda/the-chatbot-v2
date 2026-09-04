import { z } from "zod";
import type { SheetConfigDTO } from "./CashFlowSpreadsheetGatewayDTO";

export const SaveCashFlowTransferRequestDTO = z
  .object({
    id: z.uuid(),
    from: z.string().trim().min(1),
    to: z.string().trim().min(1),
    value: z.number().finite().positive().multipleOf(0.01),
    date: z.iso.date(),
    description: z.string().trim().max(160).default(""),
  })
  .refine((value) => value.from !== value.to, {
    path: ["to"],
    message: "Choose a different destination account",
  });
export type SaveCashFlowTransferRequestDTO = z.infer<
  typeof SaveCashFlowTransferRequestDTO
>;

export interface SaveSpreadsheetTransferDTO extends SheetConfigDTO {
  id: string;
  from: string;
  to: string;
  value: number;
  date: Date;
  description: string;
  category: string;
}
