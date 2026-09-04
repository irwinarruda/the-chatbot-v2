import type { SaveCashFlowTransferRequestDTO } from "~/modules/cash-flow/entities/dtos/CashFlowTransferDTO";
import {
  type CashFlowDashboardResponseDTO,
  CashFlowDashboardResponseDTO as CashFlowDashboardResponseSchema,
  type CreateCashFlowTransactionRequestDTO,
  type SyncCashFlowBankAccountRequestDTO,
} from "~/modules/cash-flow/entities/dtos/CashFlowWebDTO";
import {
  normalizeApiResponse,
  parseApiResponse,
} from "~/shared/client/utils/ApiResponseParser";
import { ApiErrorResponseDTO } from "~/shared/entities/dtos/ApiErrorDTO";

async function parseError(response: Response): Promise<Error> {
  const body = ApiErrorResponseDTO.safeParse(
    normalizeApiResponse(await response.json()),
  );
  return new Error(
    body.success ? body.data.message : `Request failed with ${response.status}`,
  );
}

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
  return parseApiResponse(CashFlowDashboardResponseSchema, data);
}

export const cashFlowService: CashFlowClientService = {
  async saveTransfer(dto, replace) {
    let url = "/api/v1/web/cash-flow/transfers";
    let method = "POST";
    if (replace) {
      url += `/${dto.id}`;
      method = "PATCH";
    }
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!response.ok) throw await parseError(response);
  },
  async deleteTransfer(id) {
    const response = await fetch(`/api/v1/web/cash-flow/transfers/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw await parseError(response);
  },
  async load() {
    const response = await fetch("/api/v1/web/cash-flow");
    if (!response.ok) throw await parseError(response);
    return parseCashFlowDashboard(await response.json());
  },

  async create(dto) {
    const response = await fetch("/api/v1/web/cash-flow/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!response.ok) throw await parseError(response);
  },

  async sync(dto) {
    const response = await fetch("/api/v1/web/cash-flow/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!response.ok) throw await parseError(response);
  },

  async deleteLast() {
    const response = await fetch("/api/v1/web/cash-flow/transactions/last", {
      method: "DELETE",
    });
    if (!response.ok) throw await parseError(response);
  },
};
