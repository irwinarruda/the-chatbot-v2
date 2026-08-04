import { useId } from "react";
import { CashFlowTransactionForm } from "~/modules/cash-flow/client/components/CashFlowTransactionForm";
import type { CreateCashFlowTransactionRequestDTO } from "~/modules/cash-flow/entities/dtos/CashFlowWebDTO";
import { TerminalResponsiveOverlay } from "~/shared/client/components/terminal/TerminalResponsiveOverlay";
import { Button } from "~/shared/client/components/ui/button";
import type { Dictionary } from "~/shared/client/i18n";

export function CashFlowTransactionDialog({
  bankAccounts,
  earningCategories,
  expenseCategories,
  isSubmitting,
  onClose,
  onSave,
  open,
  t,
}: {
  bankAccounts: string[];
  earningCategories: string[];
  expenseCategories: string[];
  isSubmitting: boolean;
  onClose: () => void;
  onSave: (value: CreateCashFlowTransactionRequestDTO) => void;
  open: boolean;
  t: Dictionary["cashFlowPage"];
}) {
  const formId = useId();

  return (
    <TerminalResponsiveOverlay
      closeLabel={t.cancelAction}
      description={t.newTransactionHint}
      footer={
        <div className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:flex sm:w-auto">
          <Button onClick={onClose} type="button" variant="outline">
            {t.cancelAction}
          </Button>
          <Button disabled={isSubmitting} form={formId} type="submit">
            {t.addAction}
          </Button>
        </div>
      }
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      open={open}
      title={t.newTransaction}
    >
      <CashFlowTransactionForm
        bankAccounts={bankAccounts}
        earningCategories={earningCategories}
        expenseCategories={expenseCategories}
        formId={formId}
        isSubmitting={isSubmitting}
        onSubmit={onSave}
        open={open}
        t={t}
      />
    </TerminalResponsiveOverlay>
  );
}
