import { act, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { CashFlowTransactionList } from "~/modules/cash-flow/client/components/CashFlowTransactionList";
import type { CashFlowTransactionResponseDTO } from "~/modules/cash-flow/entities/dtos/CashFlowWebDTO";
import { CashFlowTransactionType } from "~/modules/cash-flow/entities/enums/CashFlowTransactionType";
import { getDictionary } from "~/shared/client/i18n";

function createTransactions(count: number): CashFlowTransactionResponseDTO[] {
  return Array.from({ length: count }, (_, position) => ({
    position,
    date: "2026-07-02",
    value: -25,
    type: CashFlowTransactionType.Expense,
    category: "Food",
    description: `Transaction ${position}`,
    bankAccount: "NuConta",
    isLast: position === 0,
  }));
}

describe("CashFlowTransactionList", () => {
  test("renders transactions progressively as the load trigger is reached", () => {
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
    const t = getDictionary("en").cashFlowPage;
    render(
      <CashFlowTransactionList
        currency={
          new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "BRL",
          })
        }
        isSubmitting={false}
        locale="en"
        onDelete={() => {}}
        t={t}
        transactions={createTransactions(45)}
      />,
    );

    expect(screen.getAllByRole("article")).toHaveLength(20);

    act(() => {
      onIntersection(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(screen.getAllByRole("article")).toHaveLength(40);

    act(() => {
      onIntersection(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(screen.getAllByRole("article")).toHaveLength(45);
    expect(
      screen.queryByRole("button", { name: t.loadMoreAction }),
    ).not.toBeInTheDocument();
  });
});
