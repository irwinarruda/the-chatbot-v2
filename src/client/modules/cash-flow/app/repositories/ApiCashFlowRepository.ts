import type { CashFlowRepository } from "~/client/modules/cash-flow/app/repositories/CashFlowRepository";
import { apiClient } from "~/client/shared/app/gateways/ApiClient";
import {
  type CashFlowDashboardResponseDTO,
  CashFlowDashboardResponseDTO as CashFlowDashboardResponseSchema,
} from "~/contracts/http/cash-flow/cash-flow";

export function parseCashFlowDashboard(
  data: unknown,
): CashFlowDashboardResponseDTO {
  return CashFlowDashboardResponseSchema.parse(data);
}

export const apiCashFlowRepository: CashFlowRepository = {
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
