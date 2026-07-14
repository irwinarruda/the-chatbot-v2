import {
  type CreateMonthlyExpenseRequest,
  MonthlyExpenseItemResponse,
  MonthlyExpenseResponse,
  MonthlyExpensesResponse,
  type SetMonthlyExpensePaidRequest,
  type UpdateMonthlyExpenseRequest,
} from "~/modules/cash-flow/entities/dtos/MonthlyExpenseDTO";
import {
  normalizeApiResponse,
  parseApiResponse,
} from "~/shared/client/utils/ApiResponseParser";
import { ApiErrorResponse } from "~/shared/entities/dtos/ApiErrorDTO";

async function parseError(response: Response): Promise<Error> {
  const body = ApiErrorResponse.safeParse(
    normalizeApiResponse(await response.json()),
  );
  return new Error(
    body.success ? body.data.message : `Request failed with ${response.status}`,
  );
}

export function parseMonthlyExpense(data: unknown): MonthlyExpenseResponse {
  return parseApiResponse(MonthlyExpenseResponse, data);
}

export interface MonthlyExpenseClientService {
  list(month?: string): Promise<MonthlyExpensesResponse>;
  create(dto: CreateMonthlyExpenseRequest): Promise<MonthlyExpenseResponse>;
  update(
    id: string,
    dto: UpdateMonthlyExpenseRequest,
  ): Promise<MonthlyExpenseResponse>;
  archive(id: string): Promise<void>;
  setPaid(
    id: string,
    dto: SetMonthlyExpensePaidRequest,
  ): Promise<MonthlyExpenseResponse>;
}

export const monthlyExpenseService: MonthlyExpenseClientService = {
  async list(month) {
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    const url = `/api/v1/web/monthly-expenses${params.size ? `?${params}` : ""}`;
    const response = await fetch(url);
    if (!response.ok) throw await parseError(response);
    return parseApiResponse(MonthlyExpensesResponse, await response.json());
  },

  async create(dto) {
    const response = await fetch("/api/v1/web/monthly-expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!response.ok) throw await parseError(response);
    return parseApiResponse(MonthlyExpenseItemResponse, await response.json())
      .expense;
  },

  async update(id, dto) {
    const response = await fetch(`/api/v1/web/monthly-expenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!response.ok) throw await parseError(response);
    return parseApiResponse(MonthlyExpenseItemResponse, await response.json())
      .expense;
  },

  async archive(id) {
    const response = await fetch(`/api/v1/web/monthly-expenses/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw await parseError(response);
  },

  async setPaid(id, dto) {
    const response = await fetch(`/api/v1/web/monthly-expenses/${id}/payment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!response.ok) throw await parseError(response);
    return parseApiResponse(MonthlyExpenseItemResponse, await response.json())
      .expense;
  },
};
