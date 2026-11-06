import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { CashFlowSyncForm } from "~/client/modules/cash-flow/screens/CashFlowScreen/CashFlowSyncForm";
import { getDictionary } from "~/client/shared/i18n/dictionary";
import { useApp } from "~/client/shared/stores/app";

describe("CashFlowSyncForm", () => {
  beforeEach(() => {
    useApp.setState({ isMoneyHidden: false, isMoneyPrivacyHydrated: true });
  });

  test("rejects an untouched balance while accepting an explicit zero", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const t = getDictionary("en").cashFlowPage;
    render(
      <>
        <CashFlowSyncForm
          balances={{ NuConta: 100 }}
          bankAccounts={["NuConta"]}
          currency={
            new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "BRL",
            })
          }
          hiddenMonetaryValueLabel="Hidden monetary value"
          categories={["Balance adjustment"]}
          formId="cash-flow-sync"
          isSubmitting={false}
          onSubmit={onSubmit}
          open
          t={t}
        />
        <button form="cash-flow-sync" type="submit">
          Submit
        </button>
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(t.invalidBalanceError)).toBeInTheDocument();

    expect(screen.getByText("R$100.00")).toBeInTheDocument();

    await user.type(screen.getByLabelText(t.currentBalanceLabel), "0");

    expect(screen.getByText("-R$100.00")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ currentBalance: 0 }),
    );
  });

  test("masks the tracked balance when monetary values are hidden", () => {
    useApp.setState({ isMoneyHidden: true, isMoneyPrivacyHydrated: true });
    render(
      <CashFlowSyncForm
        balances={{ NuConta: 100 }}
        bankAccounts={["NuConta"]}
        categories={["Balance adjustment"]}
        currency={
          new Intl.NumberFormat("en-US", { style: "currency", currency: "BRL" })
        }
        formId="cash-flow-sync"
        hiddenMonetaryValueLabel="Hidden monetary value"
        isSubmitting={false}
        onSubmit={vi.fn()}
        open
        t={getDictionary("en").cashFlowPage}
      />,
    );

    expect(screen.queryByText("R$100.00")).not.toBeInTheDocument();
  });
});
