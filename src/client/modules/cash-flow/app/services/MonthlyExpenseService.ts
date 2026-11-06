import type { StateCreator } from "zustand";
import { container } from "~/client/shared/container";
import { type ApiError, clientError } from "~/client/shared/error/ApiError";
import type {
  CreateMonthlyExpenseRequestDTO,
  MonthlyExpenseDTO,
  PayMonthlyExpenseRequestDTO,
  UpdateMonthlyExpenseRequestDTO,
} from "~/contracts/http/cash-flow/monthly-expense";

export type MonthlyExpenseErrorCode = "loading" | "saving" | "deleting";

export interface MonthlyExpenseService {
  monthlyExpenses: MonthlyExpenseDTO[];
  monthlyExpenseMonth: string;
  isMonthlyExpenseBootstrapping: boolean;
  isMonthlyExpenseSubmitting: boolean;
  monthlyExpenseError?: MonthlyExpenseErrorCode | ApiError;
  bootstrapMonthlyExpenses: (month?: string) => Promise<void>;
  createMonthlyExpense: (
    dto: CreateMonthlyExpenseRequestDTO,
  ) => Promise<MonthlyExpenseDTO | undefined>;
  updateMonthlyExpense: (
    id: string,
    dto: UpdateMonthlyExpenseRequestDTO,
  ) => Promise<MonthlyExpenseDTO | undefined>;
  archiveMonthlyExpense: (id: string) => Promise<boolean>;
  setMonthlyExpensePaid: (
    id: string,
    isPaid: boolean,
  ) => Promise<MonthlyExpenseDTO | undefined>;
  clearMonthlyExpenseError: () => void;
  resetMonthlyExpenses: () => void;
  payMonthlyExpenseFromAccount: (
    id: string,
    dto: PayMonthlyExpenseRequestDTO,
  ) => Promise<MonthlyExpenseDTO | undefined>;
}

function sortMonthlyExpenses(
  expenses: MonthlyExpenseDTO[],
): MonthlyExpenseDTO[] {
  return [...expenses].sort((first, second) => {
    if (first.isPaid !== second.isPaid) return first.isPaid ? 1 : -1;
    if (first.dueDay === undefined && second.dueDay !== undefined) return 1;
    if (first.dueDay !== undefined && second.dueDay === undefined) return -1;
    if (first.dueDay !== second.dueDay) {
      return (first.dueDay ?? 0) - (second.dueDay ?? 0);
    }
    return first.name.localeCompare(second.name);
  });
}

export const createMonthlyExpenseService: StateCreator<
  MonthlyExpenseService
> = (set, get) => {
  let generation = 0;
  let view = 0;
  let listRequest = 0;
  async function refreshMonthlyExpenses(month?: string) {
    const request = ++listRequest;
    set({
      isMonthlyExpenseBootstrapping: true,
      monthlyExpenseError: undefined,
    });
    try {
      const result = await container
        .get("MonthlyExpenseRepository")
        .list(month);
      if (request !== listRequest) return;
      set({
        monthlyExpenseMonth: result.month,
        monthlyExpenses: result.expenses,
      });
    } catch (error) {
      if (request === listRequest)
        set({ monthlyExpenseError: clientError(error, "loading") });
    } finally {
      if (request === listRequest)
        set({ isMonthlyExpenseBootstrapping: false });
    }
  }
  async function reconcileMonthlyExpenses(
    requestGeneration: number,
    previousListRequest: number,
  ) {
    const { isMonthlyExpenseBootstrapping } = get();
    if (!isMonthlyExpenseBootstrapping && listRequest === previousListRequest)
      return false;
    do {
      const { monthlyExpenseMonth } = get();
      await refreshMonthlyExpenses(monthlyExpenseMonth || undefined);
      const { isMonthlyExpenseBootstrapping } = get();
      if (!isMonthlyExpenseBootstrapping) break;
    } while (requestGeneration === generation);
    return true;
  }
  return {
    monthlyExpenses: [],
    monthlyExpenseMonth: "",
    isMonthlyExpenseBootstrapping: false,
    isMonthlyExpenseSubmitting: false,
    monthlyExpenseError: undefined,
    resetMonthlyExpenses() {
      generation += 1;
      view += 1;
      listRequest += 1;
      set({
        monthlyExpenses: [],
        monthlyExpenseMonth: "",
        isMonthlyExpenseBootstrapping: false,
        isMonthlyExpenseSubmitting: false,
        monthlyExpenseError: undefined,
      });
    },
    async bootstrapMonthlyExpenses(month) {
      view += 1;
      set({ monthlyExpenseMonth: month ?? "", monthlyExpenses: [] });
      await refreshMonthlyExpenses(month);
    },
    async createMonthlyExpense(dto) {
      const { isMonthlyExpenseSubmitting } = get();
      if (isMonthlyExpenseSubmitting) return undefined;
      const requestGeneration = generation;
      const previousListRequest = listRequest;
      const requestView = view;
      set({
        isMonthlyExpenseSubmitting: true,
        monthlyExpenseError: undefined,
      });
      try {
        const { monthlyExpenseMonth } = get();
        const expense = await container.get("MonthlyExpenseRepository").create({
          ...dto,
          month: monthlyExpenseMonth || undefined,
        });
        if (requestGeneration !== generation) return undefined;
        if (requestView !== view) {
          const { bootstrapMonthlyExpenses, monthlyExpenseMonth } = get();
          await bootstrapMonthlyExpenses(monthlyExpenseMonth || undefined);
          return undefined;
        }
        const refreshed = await reconcileMonthlyExpenses(
          requestGeneration,
          previousListRequest,
        );
        if (requestGeneration !== generation || requestView !== view)
          return undefined;

        if (!refreshed)
          set((state) => {
            return {
              monthlyExpenses: sortMonthlyExpenses([
                ...state.monthlyExpenses.filter(
                  (item) => item.id !== expense.id,
                ),
                expense,
              ]),
              monthlyExpenseMonth: expense.month,
            };
          });
        return expense;
      } catch (error) {
        if (requestGeneration !== generation || requestView !== view)
          return undefined;
        set({ monthlyExpenseError: clientError(error, "saving") });
        return undefined;
      } finally {
        if (requestGeneration === generation)
          set({ isMonthlyExpenseSubmitting: false });
      }
    },
    async updateMonthlyExpense(id, dto) {
      const { isMonthlyExpenseSubmitting } = get();
      if (isMonthlyExpenseSubmitting) return undefined;
      const requestGeneration = generation;
      const previousListRequest = listRequest;
      const requestView = view;
      set({
        isMonthlyExpenseSubmitting: true,
        monthlyExpenseError: undefined,
      });
      try {
        const { monthlyExpenseMonth } = get();
        const expense = await container
          .get("MonthlyExpenseRepository")
          .update(id, {
            ...dto,
            month: monthlyExpenseMonth || undefined,
          });
        if (requestGeneration !== generation) return undefined;
        if (requestView !== view) {
          const { bootstrapMonthlyExpenses, monthlyExpenseMonth } = get();
          await bootstrapMonthlyExpenses(monthlyExpenseMonth || undefined);
          return undefined;
        }
        const refreshed = await reconcileMonthlyExpenses(
          requestGeneration,
          previousListRequest,
        );
        if (requestGeneration !== generation || requestView !== view)
          return undefined;

        if (!refreshed)
          set((state) => {
            return {
              monthlyExpenses: sortMonthlyExpenses(
                state.monthlyExpenses.map((item) => {
                  if (item.id === id) return expense;
                  return item;
                }),
              ),
            };
          });
        return expense;
      } catch (error) {
        if (requestGeneration !== generation || requestView !== view)
          return undefined;
        set({ monthlyExpenseError: clientError(error, "saving") });
        return undefined;
      } finally {
        if (requestGeneration === generation)
          set({ isMonthlyExpenseSubmitting: false });
      }
    },
    async archiveMonthlyExpense(id) {
      const { isMonthlyExpenseSubmitting, monthlyExpenseMonth } = get();
      if (isMonthlyExpenseSubmitting) return false;
      const requestGeneration = generation;
      const requestView = view;
      set({
        isMonthlyExpenseSubmitting: true,
        monthlyExpenseError: undefined,
      });
      try {
        const monthlyExpenseRepository = container.get(
          "MonthlyExpenseRepository",
        );
        await monthlyExpenseRepository.archive(id);
        if (requestGeneration !== generation) return false;
        const result = await monthlyExpenseRepository.list(
          monthlyExpenseMonth || undefined,
        );
        if (requestGeneration !== generation) return false;
        if (requestView !== view) {
          const { bootstrapMonthlyExpenses, monthlyExpenseMonth } = get();
          await bootstrapMonthlyExpenses(monthlyExpenseMonth || undefined);
          return false;
        }
        listRequest += 1;
        set({ isMonthlyExpenseBootstrapping: false });
        set({
          monthlyExpenseMonth: result.month,
          monthlyExpenses: result.expenses,
        });
        return true;
      } catch (error) {
        if (requestGeneration !== generation || requestView !== view)
          return false;
        set({ monthlyExpenseError: clientError(error, "deleting") });
        return false;
      } finally {
        if (requestGeneration === generation)
          set({ isMonthlyExpenseSubmitting: false });
      }
    },
    async setMonthlyExpensePaid(id, isPaid) {
      const { isMonthlyExpenseSubmitting, monthlyExpenseMonth } = get();
      if (isMonthlyExpenseSubmitting) return undefined;
      const requestGeneration = generation;
      const previousListRequest = listRequest;
      const requestView = view;
      set({
        isMonthlyExpenseSubmitting: true,
        monthlyExpenseError: undefined,
      });
      try {
        const expense = await container
          .get("MonthlyExpenseRepository")
          .setPaid(id, {
            isPaid,
            month: monthlyExpenseMonth || undefined,
          });
        if (requestGeneration !== generation) return undefined;
        if (requestView !== view) {
          const { bootstrapMonthlyExpenses, monthlyExpenseMonth } = get();
          await bootstrapMonthlyExpenses(monthlyExpenseMonth || undefined);
          return undefined;
        }
        const refreshed = await reconcileMonthlyExpenses(
          requestGeneration,
          previousListRequest,
        );
        if (requestGeneration !== generation || requestView !== view)
          return undefined;

        if (!refreshed)
          set((state) => {
            return {
              monthlyExpenses: sortMonthlyExpenses(
                state.monthlyExpenses.map((item) => {
                  if (item.id === id) return expense;
                  return item;
                }),
              ),
            };
          });
        return expense;
      } catch (error) {
        if (requestGeneration !== generation || requestView !== view)
          return undefined;
        set({ monthlyExpenseError: clientError(error, "saving") });
        return undefined;
      } finally {
        if (requestGeneration === generation)
          set({ isMonthlyExpenseSubmitting: false });
      }
    },
    async payMonthlyExpenseFromAccount(id, dto) {
      const { isMonthlyExpenseSubmitting } = get();
      if (isMonthlyExpenseSubmitting) return undefined;
      const requestGeneration = generation;
      const previousListRequest = listRequest;
      const requestView = view;
      set({
        isMonthlyExpenseSubmitting: true,
        monthlyExpenseError: undefined,
      });
      try {
        const expense = await container
          .get("MonthlyExpenseRepository")
          .payFromAccount(id, dto);
        if (requestGeneration !== generation) return undefined;
        if (requestView !== view) {
          const { bootstrapMonthlyExpenses, monthlyExpenseMonth } = get();
          await bootstrapMonthlyExpenses(monthlyExpenseMonth || undefined);
          return undefined;
        }
        const refreshed = await reconcileMonthlyExpenses(
          requestGeneration,
          previousListRequest,
        );
        if (requestGeneration !== generation || requestView !== view)
          return undefined;

        if (!refreshed)
          set((state) => {
            if (state.monthlyExpenseMonth !== expense.month) return {};
            return {
              monthlyExpenses: sortMonthlyExpenses(
                state.monthlyExpenses.map((item) => {
                  if (item.id === id) return expense;
                  return item;
                }),
              ),
            };
          });
        return expense;
      } catch (error) {
        if (requestGeneration !== generation || requestView !== view)
          return undefined;
        set({ monthlyExpenseError: clientError(error, "saving") });
        return undefined;
      } finally {
        if (requestGeneration === generation)
          set({ isMonthlyExpenseSubmitting: false });
      }
    },
    clearMonthlyExpenseError() {
      set({ monthlyExpenseError: undefined });
    },
  };
};
