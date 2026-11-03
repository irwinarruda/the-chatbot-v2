import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  test("switches progress from paid bill count to paid amount", async () => {
    const user = userEvent.setup();
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

    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("2 of 4 paid this month")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "50",
    );

    await user.click(screen.getByRole("button", { name: t.progressByValue }));

    const currency = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "BRL",
    });
    expect(screen.getByText("90%")).toBeInTheDocument();
    const valueDescription = `${currency.format(900)} ${t.of} ${currency.format(1000)} ${t.paidValueThisMonth}`;
    expect(
      screen.getByText(
        (_, element) =>
          element?.getAttribute("data-slot") === "card-description" &&
          element.textContent === valueDescription,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "90",
    );
    expect(
      screen.getByRole("button", { name: t.progressByValue }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
