import type { SaveCashFlowTransferRequestDTO } from "~/modules/cash-flow/entities/dtos/CashFlowTransferDTO";
import {
  type CashFlowDashboardResponseDTO,
  CashFlowDashboardResponseDTO as CashFlowDashboardResponseSchema,
  type CreateCashFlowTransactionRequestDTO,
  type SyncCashFlowBankAccountRequestDTO,
} from "~/modules/cash-flow/entities/dtos/CashFlowWebDTO";
import { apiClient } from "~/shared/client/services/ApiClient";

export interface CashFlowClientService {
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

export function parseCashFlowDashboard(
  data: unknown,
): CashFlowDashboardResponseDTO {
  return CashFlowDashboardResponseSchema.parse(data);
}

export const cashFlowService: CashFlowClientService = {
  async saveTransfer(dto, replace) {
    let url = "/api/v1/web/cash-flow/transfers";
    let method = "POST";
    if (replace) {
      url += `/${dto.id}`;
      method = "PATCH";
    }
    await apiClient.request(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
  },
  async deleteTransfer(id) {
    await apiClient.request(`/api/v1/web/cash-flow/transfers/${id}`, {
      method: "DELETE",
    });
  },
  async load() {
    const response = await apiClient.request("/api/v1/web/cash-flow");
    return parseCashFlowDashboard(await response.json());
  },

  async create(dto) {
    await apiClient.request("/api/v1/web/cash-flow/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
  },

  async sync(dto) {
    await apiClient.request("/api/v1/web/cash-flow/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
  },

  async deleteLast() {
    await apiClient.request("/api/v1/web/cash-flow/transactions/last", {
      method: "DELETE",
    });
  },
};
