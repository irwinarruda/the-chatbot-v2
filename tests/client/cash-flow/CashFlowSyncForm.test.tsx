import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { CashFlowSyncForm } from "~/modules/cash-flow/client/components/CashFlowSyncForm";
import { getDictionary } from "~/shared/client/i18n";

describe("CashFlowSyncForm", () => {
  test("rejects an untouched balance while accepting an explicit zero", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const t = getDictionary("en").cashFlowPage;
    render(
      <>
        <CashFlowSyncForm
          bankAccounts={["NuConta"]}
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

    await user.type(screen.getByLabelText(t.currentBalanceLabel), "0");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ currentBalance: 0 }),
    );
  });
});
