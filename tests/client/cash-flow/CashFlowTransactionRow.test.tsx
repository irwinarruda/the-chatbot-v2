import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { CashFlowTransactionRow } from "~/client/modules/cash-flow/screens/CashFlowScreen/CashFlowTransactionRow";
import { getDictionary } from "~/client/shared/i18n/dictionary";
import type { CashFlowTransactionResponseDTO } from "~/contracts/http/cash-flow/cash-flow";
import { CashFlowTransactionType } from "~/domain/cash-flow/cash-flow-transaction-type";

const t = getDictionary("en").cashFlowPage;

function renderRow(
  patch: Partial<CashFlowTransactionResponseDTO> = {},
  onDelete = () => {},
) {
  return render(
    <CashFlowTransactionRow
      currency={
        new Intl.NumberFormat("en-US", { style: "currency", currency: "BRL" })
      }
      hiddenMonetaryValueLabel="Hidden monetary value"
      isSubmitting={false}
      locale="en"
      onDelete={onDelete}
      t={t}
      transaction={{
        position: 4,
        date: "2026-07-02",
        value: -25,
        type: CashFlowTransactionType.Expense,
        category: "Food",
        description: "Lunch",
        bankAccount: "NuConta",
        ...patch,
      }}
    />,
  );
}

describe("CashFlowTransactionRow", () => {
  test("deletes any spreadsheet transaction after confirmation", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderRow({}, onDelete);

    await user.click(
      screen.getByRole("button", { name: t.deleteTransactionAction }),
    );
    expect(screen.getByText(t.deleteTransactionHint)).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: t.deleteAction }));

    expect(onDelete).toHaveBeenCalledOnce();
  });

  test("deletes a transfer as a pair and leaves bill payments to the bills page", () => {
    const { unmount } = renderRow({
      transferId: "a5337eac-71f5-4cce-9a4e-f2e4a95d789f",
    });
    expect(
      screen.getByRole("button", { name: t.transferDeleteAction }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: t.deleteTransactionAction }),
    ).not.toBeInTheDocument();
    unmount();

    renderRow({ paymentId: "bill-id:2026-07" });
    expect(
      screen.queryByRole("button", { name: t.deleteTransactionAction }),
    ).not.toBeInTheDocument();
  });
});
