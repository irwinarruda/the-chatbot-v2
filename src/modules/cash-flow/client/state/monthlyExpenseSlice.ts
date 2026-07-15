import type { StateCreator } from "zustand";
import {
  type MonthlyExpenseClientService,
  monthlyExpenseService,
} from "~/modules/cash-flow/client/services/monthlyExpenseService";
import type {
  CreateMonthlyExpenseRequest,
  MonthlyExpense,
  UpdateMonthlyExpenseRequest,
} from "~/modules/cash-flow/entities/dtos/MonthlyExpenseDTO";

export type MonthlyExpenseErrorCode = "loading" | "saving" | "deleting";

export interface MonthlyExpenseSlice {
  monthlyExpenses: MonthlyExpense[];
  monthlyExpenseMonth: string;
  isMonthlyExpenseBootstrapping: boolean;
  isMonthlyExpenseSubmitting: boolean;
  monthlyExpenseError?: MonthlyExpenseErrorCode;
  bootstrapMonthlyExpenses: (month?: string) => Promise<void>;
  createMonthlyExpense: (
    dto: CreateMonthlyExpenseRequest,
  ) => Promise<MonthlyExpense | undefined>;
  updateMonthlyExpense: (
    id: string,
    dto: UpdateMonthlyExpenseRequest,
  ) => Promise<MonthlyExpense | undefined>;
  archiveMonthlyExpense: (id: string) => Promise<boolean>;
  setMonthlyExpensePaid: (
    id: string,
    isPaid: boolean,
  ) => Promise<MonthlyExpense | undefined>;
  clearMonthlyExpenseError: () => void;
}

function sortMonthlyExpenses(expenses: MonthlyExpense[]): MonthlyExpense[] {
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

export function createMonthlyExpenseSlice(
  service: MonthlyExpenseClientService = monthlyExpenseService,
): StateCreator<MonthlyExpenseSlice> {
  return (set, get) => ({
    monthlyExpenses: [],
    monthlyExpenseMonth: "",
    isMonthlyExpenseBootstrapping: false,
    isMonthlyExpenseSubmitting: false,
    monthlyExpenseError: undefined,
    async bootstrapMonthlyExpenses(month) {
      set({
        isMonthlyExpenseBootstrapping: true,
        monthlyExpenseMonth: month ?? "",
        monthlyExpenses: [],
        monthlyExpenseError: undefined,
      });
      try {
        const result = await service.list(month);
        set({
          monthlyExpenseMonth: result.month,
          monthlyExpenses: result.expenses,
        });
      } catch {
        set({ monthlyExpenseError: "loading" });
      } finally {
        set({ isMonthlyExpenseBootstrapping: false });
      }
    },
    async createMonthlyExpense(dto) {
      const { isMonthlyExpenseSubmitting } = get();
      if (isMonthlyExpenseSubmitting) return undefined;
      set({ isMonthlyExpenseSubmitting: true, monthlyExpenseError: undefined });
      try {
        const { monthlyExpenseMonth } = get();
        const expense = await service.create({
          ...dto,
          month: monthlyExpenseMonth || undefined,
        });
        set((state) => ({
          monthlyExpenses: sortMonthlyExpenses([
            ...state.monthlyExpenses,
            expense,
          ]),
          monthlyExpenseMonth: expense.month,
        }));
        return expense;
      } catch {
        set({ monthlyExpenseError: "saving" });
        return undefined;
      } finally {
        set({ isMonthlyExpenseSubmitting: false });
      }
    },
    async updateMonthlyExpense(id, dto) {
      const { isMonthlyExpenseSubmitting } = get();
      if (isMonthlyExpenseSubmitting) return undefined;
      set({ isMonthlyExpenseSubmitting: true, monthlyExpenseError: undefined });
      try {
        const { monthlyExpenseMonth } = get();
        const expense = await service.update(id, {
          ...dto,
          month: monthlyExpenseMonth || undefined,
        });
        set((state) => ({
          monthlyExpenses: sortMonthlyExpenses(
            state.monthlyExpenses.map((item) =>
              item.id === id ? expense : item,
            ),
          ),
        }));
        return expense;
      } catch {
        set({ monthlyExpenseError: "saving" });
        return undefined;
      } finally {
        set({ isMonthlyExpenseSubmitting: false });
      }
    },
    async archiveMonthlyExpense(id) {
      const { isMonthlyExpenseSubmitting, monthlyExpenseMonth } = get();
      if (isMonthlyExpenseSubmitting) return false;
      set({ isMonthlyExpenseSubmitting: true, monthlyExpenseError: undefined });
      try {
        await service.archive(id);
        const result = await service.list(monthlyExpenseMonth || undefined);
        set({
          monthlyExpenseMonth: result.month,
          monthlyExpenses: result.expenses,
        });
        return true;
      } catch {
        set({ monthlyExpenseError: "deleting" });
        return false;
      } finally {
        set({ isMonthlyExpenseSubmitting: false });
      }
    },
    async setMonthlyExpensePaid(id, isPaid) {
      const { isMonthlyExpenseSubmitting, monthlyExpenseMonth } = get();
      if (isMonthlyExpenseSubmitting) return undefined;
      set({ isMonthlyExpenseSubmitting: true, monthlyExpenseError: undefined });
      try {
        const expense = await service.setPaid(id, {
          isPaid,
          month: monthlyExpenseMonth || undefined,
        });
        set((state) => ({
          monthlyExpenses: sortMonthlyExpenses(
            state.monthlyExpenses.map((item) =>
              item.id === id ? expense : item,
            ),
          ),
        }));
        return expense;
      } catch {
        set({ monthlyExpenseError: "saving" });
        return undefined;
      } finally {
        set({ isMonthlyExpenseSubmitting: false });
      }
    },
    clearMonthlyExpenseError() {
      set({ monthlyExpenseError: undefined });
    },
  });
}

export const monthlyExpenseSlice = createMonthlyExpenseSlice();
