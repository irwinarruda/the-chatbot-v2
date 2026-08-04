import { useId } from "react";
import { CashFlowSyncForm } from "~/modules/cash-flow/client/components/CashFlowSyncForm";
import type { SyncCashFlowBankAccountRequestDTO } from "~/modules/cash-flow/entities/dtos/CashFlowWebDTO";
import { TerminalResponsiveOverlay } from "~/shared/client/components/terminal/TerminalResponsiveOverlay";
import { Button } from "~/shared/client/components/ui/button";
import type { Dictionary } from "~/shared/client/i18n";

export function CashFlowSyncDialog({
  bankAccounts,
  categories,
  isSubmitting,
  onClose,
  onSave,
  open,
  t,
}: {
  bankAccounts: string[];
  categories: string[];
  isSubmitting: boolean;
  onClose: () => void;
  onSave: (value: SyncCashFlowBankAccountRequestDTO) => void;
  open: boolean;
  t: Dictionary["cashFlowPage"];
}) {
  const formId = useId();

  return (
    <TerminalResponsiveOverlay
      closeLabel={t.cancelAction}
      description={t.syncHint}
      footer={
        <div className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:flex sm:w-auto">
          <Button onClick={onClose} type="button" variant="outline">
            {t.cancelAction}
          </Button>
          <Button disabled={isSubmitting} form={formId} type="submit">
            {t.syncAction}
          </Button>
        </div>
      }
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      open={open}
      title={t.syncTitle}
    >
      <CashFlowSyncForm
        bankAccounts={bankAccounts}
        categories={categories}
        formId={formId}
        isSubmitting={isSubmitting}
        onSubmit={onSave}
        open={open}
        t={t}
      />
    </TerminalResponsiveOverlay>
  );
}
