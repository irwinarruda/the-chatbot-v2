import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { CashFlowTransactionRow } from "~/client/modules/cash-flow/screens/CashFlowScreen/CashFlowTransactionRow";
import { getDictionary } from "~/client/shared/i18n/dictionary";
import type { CashFlowTransactionResponseDTO } from "~/contracts/http/cash-flow/cash-flow";
import { CashFlowTransactionType } from "~/domain/cash-flow/cash-flow-transaction-type";

function createTransaction(isLast: boolean): CashFlowTransactionResponseDTO {
  return {
    position: 0,
    date: "2026-07-02",
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
        hiddenMonetaryValueLabel="Hidden monetary value"
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
        hiddenMonetaryValueLabel="Hidden monetary value"
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
