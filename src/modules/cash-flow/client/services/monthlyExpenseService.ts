import {
  type CreateMonthlyExpenseRequestDTO,
  MonthlyExpenseItemResponseDTO,
  MonthlyExpenseResponseDTO,
  MonthlyExpensesResponseDTO,
  type PayMonthlyExpenseRequestDTO,
  type SetMonthlyExpensePaidRequestDTO,
  type UpdateMonthlyExpenseRequestDTO,
} from "~/modules/cash-flow/entities/dtos/MonthlyExpenseDTO";
import { apiClient } from "~/shared/client/services/ApiClient";

export function parseMonthlyExpense(data: unknown): MonthlyExpenseResponseDTO {
  return MonthlyExpenseResponseDTO.parse(data);
}

export interface MonthlyExpenseClientService {
  list(month?: string): Promise<MonthlyExpensesResponseDTO>;
  create(
    dto: CreateMonthlyExpenseRequestDTO,
  ): Promise<MonthlyExpenseResponseDTO>;
  update(
    id: string,
    dto: UpdateMonthlyExpenseRequestDTO,
  ): Promise<MonthlyExpenseResponseDTO>;
  archive(id: string): Promise<void>;
  payFromAccount(
    id: string,
    dto: PayMonthlyExpenseRequestDTO,
  ): Promise<MonthlyExpenseResponseDTO>;
  setPaid(
    id: string,
    dto: SetMonthlyExpensePaidRequestDTO,
  ): Promise<MonthlyExpenseResponseDTO>;
}

export const monthlyExpenseService: MonthlyExpenseClientService = {
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
