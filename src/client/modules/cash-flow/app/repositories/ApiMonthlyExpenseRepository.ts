import type { MonthlyExpenseRepository } from "~/client/modules/cash-flow/app/repositories/MonthlyExpenseRepository";
import { apiClient } from "~/client/shared/app/gateways/ApiClient";
import {
  MonthlyExpenseItemResponseDTO,
  MonthlyExpenseResponseDTO,
  MonthlyExpensesResponseDTO,
} from "~/contracts/http/cash-flow/monthly-expense";

export function parseMonthlyExpense(data: unknown): MonthlyExpenseResponseDTO {
  return MonthlyExpenseResponseDTO.parse(data);
}

export const apiMonthlyExpenseRepository: MonthlyExpenseRepository = {
  async payFromAccount(id, dto) {
    const response = await apiClient.request(
      `/api/v1/web/monthly-expenses/${id}/bank-payment`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dto),
      },
    );
    return MonthlyExpenseItemResponseDTO.parse(await response.json()).expense;
  },
  async list(month) {
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    const url = `/api/v1/web/monthly-expenses${params.size ? `?${params}` : ""}`;
    const response = await apiClient.request(url);
    return MonthlyExpensesResponseDTO.parse(await response.json());
  },

  async create(dto) {
    const response = await apiClient.request("/api/v1/web/monthly-expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    return MonthlyExpenseItemResponseDTO.parse(await response.json()).expense;
  },

  async update(id, dto) {
    const response = await apiClient.request(
      `/api/v1/web/monthly-expenses/${id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dto),
      },
    );
    return MonthlyExpenseItemResponseDTO.parse(await response.json()).expense;
  },

  async archive(id) {
    await apiClient.request(`/api/v1/web/monthly-expenses/${id}`, {
      method: "DELETE",
    });
  },

  async setPaid(id, dto) {
    const response = await apiClient.request(
      `/api/v1/web/monthly-expenses/${id}/payment`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dto),
      },
    );
    return MonthlyExpenseItemResponseDTO.parse(await response.json()).expense;
  },
};
