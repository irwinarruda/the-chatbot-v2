import type { StateCreator } from "zustand";
import { container } from "~/client/shared/container";
import { type ApiError, clientError } from "~/client/shared/error/ApiError";
import type {
  CashFlowDashboardResponseDTO,
  CreateCashFlowTransactionRequestDTO,
  SyncCashFlowBankAccountRequestDTO,
} from "~/contracts/http/cash-flow/cash-flow";
import type { SaveCashFlowTransferRequestDTO } from "~/contracts/http/cash-flow/cash-flow-transfer";

export type CashFlowErrorCode = "loading" | "saving" | "syncing" | "deleting";

export interface CashFlowService {
  cashFlowDashboard: CashFlowDashboardResponseDTO;
  isCashFlowBootstrapping: boolean;
  isCashFlowSubmitting: boolean;
  cashFlowError?: CashFlowErrorCode | ApiError;
  bootstrapCashFlow: () => Promise<void>;
  createCashFlowTransaction: (
    dto: CreateCashFlowTransactionRequestDTO,
  ) => Promise<boolean>;
  syncCashFlowBankAccount: (
    dto: SyncCashFlowBankAccountRequestDTO,
  ) => Promise<boolean>;
  deleteLastCashFlowTransaction: () => Promise<boolean>;
  clearCashFlowError: () => void;
  resetCashFlow: () => void;
  saveCashFlowTransfer: (
    dto: SaveCashFlowTransferRequestDTO,
    replace: boolean,
  ) => Promise<boolean>;
  deleteCashFlowTransfer: (id: string) => Promise<boolean>;
}

function emptyCashFlowDashboard(): CashFlowDashboardResponseDTO {
  return {
    transactions: [],
    bankAccounts: [],
    expenseCategories: [],
    earningCategories: [],
    bankAccountStatuses: [],
  };
}

export const createCashFlowService: StateCreator<CashFlowService> = (
  set,
  get,
) => {
  let generation = 0;
  let listRequest = 0;
  async function refreshDashboard() {
    const request = ++listRequest;
    set({ isCashFlowBootstrapping: false });
    try {
      const dashboard = await container.get("CashFlowRepository").load();
      if (request === listRequest) set({ cashFlowDashboard: dashboard });
    } catch (error) {
      if (request === listRequest)
        set({ cashFlowError: clientError(error, "loading") });
    }
  }
  async function mutateCashFlow(
    action: () => Promise<unknown>,
    failure: CashFlowErrorCode,
    onCommitted?: () => void,
  ) {
    const { isCashFlowSubmitting } = get();
    if (isCashFlowSubmitting) return false;
    const request = generation;
    listRequest += 1;
    set({
      isCashFlowBootstrapping: false,
      isCashFlowSubmitting: true,
      cashFlowError: undefined,
    });
    try {
      await action();
      if (request !== generation) return false;
      onCommitted?.();
      await refreshDashboard();
      return request === generation;
    } catch (error) {
      if (request === generation)
        set({ cashFlowError: clientError(error, failure) });
      return false;
    } finally {
      if (request === generation) set({ isCashFlowSubmitting: false });
    }
  }

  return {
    cashFlowDashboard: emptyCashFlowDashboard(),
    isCashFlowBootstrapping: false,
    isCashFlowSubmitting: false,
    cashFlowError: undefined,
    resetCashFlow() {
      generation += 1;
      listRequest += 1;
      set({
        cashFlowDashboard: emptyCashFlowDashboard(),
        isCashFlowBootstrapping: false,
        isCashFlowSubmitting: false,
        cashFlowError: undefined,
      });
    },
    async bootstrapCashFlow() {
      const request = ++listRequest;
      set({ isCashFlowBootstrapping: true, cashFlowError: undefined });
      try {
        const dashboard = await container.get("CashFlowRepository").load();
        if (request === listRequest) set({ cashFlowDashboard: dashboard });
      } catch (error) {
        if (request === listRequest)
          set({ cashFlowError: clientError(error, "loading") });
      } finally {
        if (request === listRequest) set({ isCashFlowBootstrapping: false });
      }
    },
    createCashFlowTransaction(dto) {
      return mutateCashFlow(
        () => container.get("CashFlowRepository").create(dto),
        "saving",
      );
    },
    syncCashFlowBankAccount(dto) {
      return mutateCashFlow(
        () => container.get("CashFlowRepository").sync(dto),
        "syncing",
      );
    },
    async deleteLastCashFlowTransaction() {
      const { cashFlowDashboard } = get();
      if (!cashFlowDashboard.transactions.some(({ isLast }) => isLast))
        return false;
      return mutateCashFlow(
        () => container.get("CashFlowRepository").deleteLast(),
        "deleting",
        () => {
          const last = cashFlowDashboard.transactions.find(
            ({ isLast }) => isLast,
          );
          set((state) => ({
            cashFlowDashboard: {
              ...state.cashFlowDashboard,
              transactions: state.cashFlowDashboard.transactions.filter(
                (item) =>
                  !item.isLast &&
                  (!last?.transferId || item.transferId !== last.transferId),
              ),
            },
          }));
        },
      );
    },
    saveCashFlowTransfer(dto, replace) {
      return mutateCashFlow(
        () => container.get("CashFlowRepository").saveTransfer(dto, replace),
        "saving",
      );
    },
    deleteCashFlowTransfer(id) {
      return mutateCashFlow(
        () => container.get("CashFlowRepository").deleteTransfer(id),
        "deleting",
      );
    },
    clearCashFlowError() {
      set({ cashFlowError: undefined });
    },
  };
};
