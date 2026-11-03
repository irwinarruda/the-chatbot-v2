import type {
  CashFlowDashboardResponseDTO,
  CreateCashFlowTransactionRequestDTO,
  SyncCashFlowBankAccountRequestDTO,
} from "~/contracts/http/cash-flow/cash-flow";
import type { SaveCashFlowTransferRequestDTO } from "~/contracts/http/cash-flow/cash-flow-transfer";

export interface CashFlowRepository {
  load(): Promise<CashFlowDashboardResponseDTO>;
  create(dto: CreateCashFlowTransactionRequestDTO): Promise<void>;
  sync(dto: SyncCashFlowBankAccountRequestDTO): Promise<void>;
  deleteLast(): Promise<void>;
  saveTransfer(
    dto: SaveCashFlowTransferRequestDTO,
    replace: boolean,
  ): Promise<void>;
  deleteTransfer(id: string): Promise<void>;
}
