import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { CashFlowTransactionRow } from "~/modules/cash-flow/client/components/CashFlowTransactionRow";
import type { CashFlowTransactionResponseDTO } from "~/modules/cash-flow/entities/dtos/CashFlowWebDTO";
import { CashFlowTransactionType } from "~/modules/cash-flow/entities/enums/CashFlowTransactionType";
import { getDictionary } from "~/shared/client/i18n";

function createTransaction(isLast: boolean): CashFlowTransactionResponseDTO {
  return {
    position: 0,
    date: "2026-07-02T12:00:00.000Z",
    value: -25,
    type: CashFlowTransactionType.Expense,
    category: "Food",
    description: "Lunch",
    bankAccount: "NuConta",
    isLast,
  };
}

describe("CashFlowTransactionRow", () => {
  test("offers deletion only for the latest spreadsheet transaction", () => {
    const t = getDictionary("en").cashFlowPage;
    const currency = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "BRL",
    });
    const { rerender } = render(
      <CashFlowTransactionRow
        currency={currency}
        isSubmitting={false}
        locale="en"
        onDelete={() => {}}
        t={t}
        transaction={createTransaction(false)}
      />,
    );

    expect(
      screen.queryByRole("button", { name: t.deleteLastAction }),
    ).not.toBeInTheDocument();

    rerender(
      <CashFlowTransactionRow
        currency={currency}
        isSubmitting={false}
        locale="en"
        onDelete={() => {}}
        t={t}
        transaction={createTransaction(true)}
      />,
    );

    expect(
      screen.getByRole("button", { name: t.deleteLastAction }),
    ).toBeInTheDocument();
  });
});
