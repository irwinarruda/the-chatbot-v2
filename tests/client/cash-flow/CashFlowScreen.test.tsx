import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CashFlowScreen } from "~/client/modules/cash-flow/screens/CashFlowScreen";
import { getDictionary } from "~/client/shared/i18n/dictionary";
import { useApp } from "~/client/shared/stores/app";
import type { CashFlowTransactionResponseDTO } from "~/contracts/http/cash-flow/cash-flow";
import { CashFlowTransactionType } from "~/domain/cash-flow/cash-flow-transaction-type";

vi.mock("@tanstack/react-router", () => ({
  Link: (props: { children?: ReactNode }) => <a href="/">{props.children}</a>,
  useNavigate: () => vi.fn(),
}));

vi.mock("~/client/shared/hooks/usePrefs", () => ({
  usePrefs: () => ({ locale: "en", theme: "dark", palette: "barro" }),
}));

vi.mock("~/client/shared/components/terminal/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const t = getDictionary("en").cashFlowPage;
const initialState = useApp.getState();

function createTransactions(count: number): CashFlowTransactionResponseDTO[] {
  return Array.from({ length: count }, (_, position) => ({
    position,
    date: "2026-07-02",
    value: -25,
    type: CashFlowTransactionType.Expense,
    category: "Food",
    description: `Transaction ${position}`,
    bankAccount: "NuConta",
  }));
}

beforeEach(() => {
  useApp.setState(initialState, true);
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});

afterEach(() => {
  useApp.setState(initialState, true);
});

describe("CashFlowScreen", () => {
  test("keeps the loaded rows when a transaction far down the list is deleted", async () => {
    let onIntersection: IntersectionObserverCallback = () => {};
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          onIntersection = callback;
        }

        observe() {}

        disconnect() {}
      },
    );
    const deleteTransaction = vi.fn(
      async (transaction: CashFlowTransactionResponseDTO) => {
        useApp.setState((state) => ({
          cashFlowDashboard: {
            ...state.cashFlowDashboard,
            transactions: state.cashFlowDashboard.transactions.filter(
              (item) => item.position !== transaction.position,
            ),
          },
        }));
        return true;
      },
    );
    useApp.setState({
      bootstrapCashFlow: async () => {},
      deleteCashFlowTransaction: deleteTransaction,
      cashFlowDashboard: {
        transactions: createTransactions(45),
        bankAccounts: ["NuConta"],
        expenseCategories: ["Food"],
        earningCategories: [],
        bankAccountStatuses: [],
      },
    });
    const user = userEvent.setup();
    render(<CashFlowScreen search={{}} />);
    act(() => {
      onIntersection(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    expect(screen.getAllByRole("article")).toHaveLength(40);

    const row = screen
      .getByRole("heading", { name: "Transaction 10" })
      .closest("article");
    if (!row) throw new Error("The row was not rendered");
    await user.click(
      within(row).getByRole("button", { name: t.deleteTransactionAction }),
    );
    await user.click(screen.getByRole("button", { name: t.deleteAction }));

    expect(deleteTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ position: 10, description: "Transaction 10" }),
    );
    expect(
      screen.queryByRole("heading", { name: "Transaction 10" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(40);
  });
});
