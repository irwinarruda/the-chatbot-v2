import type { StateCreator } from "zustand";
import {
  type CashFlowClientService,
  cashFlowService,
} from "~/modules/cash-flow/client/services/cashFlowService";
import type {
  CashFlowDashboardResponseDTO,
  CreateCashFlowTransactionRequestDTO,
  SyncCashFlowBankAccountRequestDTO,
} from "~/modules/cash-flow/entities/dtos/CashFlowWebDTO";

export type CashFlowErrorCode = "loading" | "saving" | "syncing" | "deleting";

export interface CashFlowSlice {
  cashFlowDashboard: CashFlowDashboardResponseDTO;
  isCashFlowBootstrapping: boolean;
  isCashFlowSubmitting: boolean;
  cashFlowError?: CashFlowErrorCode;
  bootstrapCashFlow: () => Promise<void>;
  createCashFlowTransaction: (
    dto: CreateCashFlowTransactionRequestDTO,
  ) => Promise<boolean>;
  syncCashFlowBankAccount: (
    dto: SyncCashFlowBankAccountRequestDTO,
  ) => Promise<boolean>;
  deleteLastCashFlowTransaction: () => Promise<boolean>;
  clearCashFlowError: () => void;
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

export function createCashFlowSlice(
  service: CashFlowClientService = cashFlowService,
): StateCreator<CashFlowSlice> {
  return (set, get) => {
    async function refreshDashboard(): Promise<void> {
      try {
        set({ cashFlowDashboard: await service.load() });
      } catch {
        set({ cashFlowError: "loading" });
      }
    }

    return {
      cashFlowDashboard: emptyCashFlowDashboard(),
      isCashFlowBootstrapping: false,
      isCashFlowSubmitting: false,
      cashFlowError: undefined,
      async bootstrapCashFlow() {
        set({ isCashFlowBootstrapping: true, cashFlowError: undefined });
        try {
          await refreshDashboard();
        } finally {
          set({ isCashFlowBootstrapping: false });
        }
      },
      async createCashFlowTransaction(dto) {
        const { isCashFlowSubmitting } = get();
        if (isCashFlowSubmitting) return false;
        set({ isCashFlowSubmitting: true, cashFlowError: undefined });
        try {
          await service.create(dto);
          await refreshDashboard();
          return true;
        } catch {
          set({ cashFlowError: "saving" });
          return false;
        } finally {
          set({ isCashFlowSubmitting: false });
        }
      },
      async syncCashFlowBankAccount(dto) {
        const { isCashFlowSubmitting } = get();
        if (isCashFlowSubmitting) return false;
        set({ isCashFlowSubmitting: true, cashFlowError: undefined });
        try {
          await service.sync(dto);
          await refreshDashboard();
          return true;
        } catch {
          set({ cashFlowError: "syncing" });
          return false;
        } finally {
          set({ isCashFlowSubmitting: false });
        }
      },
      async deleteLastCashFlowTransaction() {
        const { cashFlowDashboard, isCashFlowSubmitting } = get();
        if (isCashFlowSubmitting) return false;
        if (!cashFlowDashboard.transactions.some(({ isLast }) => isLast)) {
          return false;
        }
        set({ isCashFlowSubmitting: true, cashFlowError: undefined });
        try {
          await service.deleteLast();
          set((state) => ({
            cashFlowDashboard: {
              ...state.cashFlowDashboard,
              transactions: state.cashFlowDashboard.transactions.filter(
                ({ isLast }) => !isLast,
              ),
            },
          }));
          await refreshDashboard();
          return true;
        } catch {
          set({ cashFlowError: "deleting" });
          return false;
        } finally {
          set({ isCashFlowSubmitting: false });
        }
      },
      clearCashFlowError() {
        set({ cashFlowError: undefined });
      },
    };
  };
}

export const cashFlowSlice = createCashFlowSlice();
