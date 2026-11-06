import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { MonthlyExpenseForm } from "~/client/modules/cash-flow/screens/BillsScreen/MonthlyExpenseForm";
import { getDictionary } from "~/client/shared/i18n/dictionary";

const t = getDictionary("en").billsPage;
const expense = {
  id: "c9b2c0f0-5397-44d3-b963-bc5c94c08dcc",
  name: "Home internet",
  expectedAmount: 120.25,
  month: "2026-09",
  isPaid: false,
  createdAt: "2026-09-01T12:00:00Z",
  updatedAt: "2026-09-01T12:00:00Z",
};

describe("MonthlyExpenseForm", () => {
  test("keeps a bill's category and default account when editing before the spreadsheet lists load", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <MonthlyExpenseForm
        bankAccounts={[]}
        categories={[]}
        expense={{
          ...expense,
          category: "Housing",
          defaultBankAccount: "Caju",
        }}
        isSubmitting={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        t={t}
      />,
    );
    expect(screen.getByLabelText(t.categoryLabel)).toHaveValue("Housing");
    expect(screen.getByLabelText(t.defaultBankAccountLabel)).toHaveValue(
      "Caju",
    );
    await user.click(screen.getByRole("button", { name: t.saveAction }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Home internet",
        category: "Housing",
        defaultBankAccount: "Caju",
      }),
    );
    await user.selectOptions(
      screen.getByLabelText(t.categoryLabel),
      t.noCategory,
    );
    await user.click(screen.getByRole("button", { name: t.saveAction }));
    expect(onSubmit).toHaveBeenLastCalledWith(
      expect.objectContaining({ category: undefined }),
    );
  });
});
