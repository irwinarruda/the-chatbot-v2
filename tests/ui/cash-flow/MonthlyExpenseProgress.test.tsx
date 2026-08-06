import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { MonthlyExpenseProgress } from "~/modules/cash-flow/client/components/MonthlyExpenseProgress";
import type { MonthlyExpenseDTO } from "~/modules/cash-flow/entities/dtos/MonthlyExpenseDTO";
import { getDictionary } from "~/shared/client/i18n";

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
  test("switches progress from paid bill count to paid amount", async () => {
    const user = userEvent.setup();
    const t = getDictionary("en").billsPage;
    const expenses = [
      createExpense(800, true),
      createExpense(100, true),
      createExpense(50, false),
      createExpense(50, false),
    ];
    render(<MonthlyExpenseProgress expenses={expenses} locale="en" t={t} />);

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
    expect(
      screen.getByText(
        `${currency.format(900)} of ${currency.format(1000)} paid this month`,
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
