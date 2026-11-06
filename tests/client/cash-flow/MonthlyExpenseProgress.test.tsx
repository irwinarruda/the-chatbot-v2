import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { MonthlyExpenseProgress } from "~/client/modules/cash-flow/screens/BillsScreen/MonthlyExpenseProgress";
import { getDictionary } from "~/client/shared/i18n/dictionary";
import { useApp } from "~/client/shared/stores/app";
import type { MonthlyExpenseDTO } from "~/contracts/http/cash-flow/monthly-expense";

function createExpense(
  expectedAmount: number,
  isPaid: boolean,
): MonthlyExpenseDTO {
  let paidAt: string | undefined;
  if (isPaid) paidAt = "2026-08-05T12:00:00.000Z";
  return {
    id: crypto.randomUUID(),
    name: "Monthly bill",
    expectedAmount,
    month: "2026-08",
    isPaid,
    paidAt,
    createdAt: "2026-08-01T12:00:00.000Z",
    updatedAt: "2026-08-05T12:00:00.000Z",
  };
}

describe("MonthlyExpenseProgress", () => {
  beforeEach(() => {
    useApp.setState({
      isMoneyHidden: false,
      isMoneyPrivacyHydrated: true,
    });
  });

  test("leads with the amount left to pay and tracks progress by amount", () => {
    const t = getDictionary("en").billsPage;
    const expenses = [
      createExpense(800, true),
      createExpense(100, true),
      createExpense(50, false),
      createExpense(50, false),
    ];
    render(
      <MonthlyExpenseProgress
        expenses={expenses}
        hiddenMonetaryValueLabel="Hidden monetary value"
        locale="en"
        t={t}
      />,
    );

    const currency = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "BRL",
    });
    expect(screen.getByText(t.leftToPay)).toBeInTheDocument();
    expect(screen.getByText(currency.format(100))).toBeInTheDocument();
    expect(
      screen.getByText("2 of 4 bills paid · 90% of the amount"),
    ).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "90",
    );
  });
});
