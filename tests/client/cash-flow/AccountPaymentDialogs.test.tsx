import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MonthlyExpensePaymentDialog } from "~/client/modules/cash-flow/screens/BillsScreen/MonthlyExpensePaymentDialog";
import { MonthlyExpenseRow } from "~/client/modules/cash-flow/screens/BillsScreen/MonthlyExpenseRow";
import { CashFlowTransferDialog } from "~/client/modules/cash-flow/screens/CashFlowScreen/CashFlowTransferDialog";
import { getDictionary } from "~/client/shared/i18n/dictionary";

const dictionary = getDictionary("en");
const expense = {
  id: "c9b2c0f0-5397-44d3-b963-bc5c94c08dcc",
  name: "Home internet",
  expectedAmount: 120.25,
  month: "2026-09",
  isPaid: false,
  createdAt: "2026-09-01T12:00:00Z",
  updatedAt: "2026-09-01T12:00:00Z",
};

beforeEach(() => {
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

describe("Account payment interactions", () => {
  test("saves a transfer with an optional description and blocks matching accounts", async () => {
    const user = userEvent.setup();
    const t = dictionary.cashFlowPage;
    const onSave = vi.fn();
    render(
      <CashFlowTransferDialog
        bankAccounts={["NuConta", "Caju"]}
        initialValue={{
          id: "a5337eac-71f5-4cce-9a4e-f2e4a95d789f",
          from: "NuConta",
          to: "",
          value: 0,
          date: "2026-09-04",
          description: "",
        }}
        isEditing={false}
        isSubmitting={false}
        onClose={vi.fn()}
        onSave={onSave}
        t={t}
      />,
    );
    expect(
      await screen.findByRole("dialog", { name: t.transferAction }),
    ).toBeVisible();
    await user.selectOptions(
      screen.getByLabelText(t.destinationAccountLabel),
      "Caju",
    );
    await user.type(screen.getByLabelText(t.amountLabel), "125.50");
    await user.click(
      screen.getByRole("button", { name: t.transferSaveAction }),
    );
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "NuConta",
        to: "Caju",
        value: 125.5,
        description: "",
      }),
    );
    await user.selectOptions(
      screen.getByLabelText(t.sourceAccountLabel),
      "Caju",
    );
    expect(screen.getByText(t.sameAccountError)).toBeVisible();
    expect(
      screen.getByRole("button", { name: t.transferSaveAction }),
    ).toBeDisabled();
  });

  test("keeps the checkbox separate from bank payment and hides payment for an already linked bill", async () => {
    const user = userEvent.setup();
    const t = dictionary.billsPage;
    const onTogglePaid = vi.fn();
    const onPayFromAccount = vi.fn();
    const props = {
      expense,
      hiddenMonetaryValueLabel: "Hidden amount",
      isSubmitting: false,
      locale: "en" as const,
      onEdit: vi.fn(),
      onTogglePaid,
      onPayFromAccount,
      t,
    };
    const { rerender } = render(<MonthlyExpenseRow {...props} />);
    await user.click(screen.getByRole("checkbox"));
    expect(onTogglePaid).toHaveBeenCalledOnce();
    expect(onPayFromAccount).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: t.payFromAccount }));
    expect(onPayFromAccount).toHaveBeenCalledOnce();
    rerender(
      <MonthlyExpenseRow
        {...props}
        bankAccount="NuConta"
        expense={{ ...expense, isPaid: true }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: t.payFromAccount }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(`${t.paymentRecorded} NuConta`)).toBeVisible();
  });

  test("asks for a category on a bill without one and submits the account, category, month and date", async () => {
    const user = userEvent.setup();
    const t = dictionary.billsPage;
    const onSave = vi.fn();
    render(
      <MonthlyExpensePaymentDialog
        expense={{ ...expense, category: "Removed from spreadsheet" }}
        bankAccounts={["NuConta", "Caju"]}
        categories={["Internet", "Housing"]}
        hiddenMonetaryValueLabel="Hidden amount"
        isLoading={false}
        isSubmitting={false}
        loadError={false}
        paymentError={false}
        locale="en"
        onClose={vi.fn()}
        onSave={onSave}
        t={t}
      />,
    );
    await screen.findByRole("dialog", { name: t.payFromAccount });
    expect(
      screen.getByRole("button", { name: t.paymentConfirm }),
    ).toBeDisabled();
    await user.selectOptions(
      screen.getByLabelText(t.paymentAccountLabel),
      "NuConta",
    );
    expect(
      screen.getByRole("button", { name: t.paymentConfirm }),
    ).toBeDisabled();
    expect(screen.getByText(t.paymentCategoryHint)).toBeVisible();
    expect(screen.getByText(t.paymentAccountHint)).toBeVisible();
    await user.selectOptions(
      screen.getByLabelText(t.paymentCategoryLabel),
      "Internet",
    );
    await user.clear(screen.getByLabelText(t.paymentDateLabel));
    await user.type(screen.getByLabelText(t.paymentDateLabel), "2026-09-03");
    await user.click(screen.getByRole("button", { name: t.paymentConfirm }));
    expect(onSave).toHaveBeenCalledWith({
      bankAccount: "NuConta",
      category: "Internet",
      month: "2026-09",
      date: "2026-09-03",
    });
  });

  test("pays with the bill's saved category and default account without asking", async () => {
    const user = userEvent.setup();
    const t = dictionary.billsPage;
    const onSave = vi.fn();
    render(
      <MonthlyExpensePaymentDialog
        expense={{
          ...expense,
          category: "Housing",
          defaultBankAccount: "Caju",
        }}
        bankAccounts={["NuConta", "Caju"]}
        categories={["Internet", "Housing"]}
        hiddenMonetaryValueLabel="Hidden amount"
        isLoading={false}
        isSubmitting={false}
        loadError={false}
        paymentError={false}
        locale="en"
        onClose={vi.fn()}
        onSave={onSave}
        t={t}
      />,
    );
    await screen.findByRole("dialog", { name: t.payFromAccount });
    expect(
      screen.queryByLabelText(t.paymentCategoryLabel),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Housing")).toBeVisible();
    expect(screen.getByLabelText(t.paymentAccountLabel)).toHaveValue("Caju");
    expect(screen.queryByText(t.paymentAccountHint)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: t.paymentConfirm }));
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({ bankAccount: "Caju", category: "Housing" }),
    );
    await user.selectOptions(
      screen.getByLabelText(t.paymentAccountLabel),
      "NuConta",
    );
    await user.click(screen.getByRole("button", { name: t.paymentConfirm }));
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({ bankAccount: "NuConta" }),
    );
  });

  test("asks for an account without promising a new default when the saved one left the spreadsheet", async () => {
    const t = dictionary.billsPage;
    render(
      <MonthlyExpensePaymentDialog
        expense={{
          ...expense,
          category: "Housing",
          defaultBankAccount: "Closed account",
        }}
        bankAccounts={["NuConta", "Caju"]}
        categories={["Housing"]}
        hiddenMonetaryValueLabel="Hidden amount"
        isLoading={false}
        isSubmitting={false}
        loadError={false}
        paymentError={false}
        locale="en"
        onClose={vi.fn()}
        onSave={vi.fn()}
        t={t}
      />,
    );
    await screen.findByRole("dialog", { name: t.payFromAccount });
    expect(screen.getByLabelText(t.paymentAccountLabel)).toHaveValue("");
    expect(screen.queryByText(t.paymentAccountHint)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: t.paymentConfirm }),
    ).toBeDisabled();
  });

  test("shows the bill's category on its row", () => {
    const t = dictionary.billsPage;
    render(
      <MonthlyExpenseRow
        expense={{ ...expense, category: "Housing" }}
        hiddenMonetaryValueLabel="Hidden amount"
        isSubmitting={false}
        locale="en"
        onEdit={vi.fn()}
        onPayFromAccount={vi.fn()}
        onTogglePaid={vi.fn()}
        t={t}
      />,
    );
    expect(screen.getByText("Housing")).toBeVisible();
    expect(screen.getByText(`${t.categoryLabel}:`)).toBeInTheDocument();
  });
});
