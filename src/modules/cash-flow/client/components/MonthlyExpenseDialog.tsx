import { AlertTriangle, Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import {
  MonthlyExpenseForm,
  type MonthlyExpenseFormValue,
} from "~/modules/cash-flow/client/components/MonthlyExpenseForm";
import type { MonthlyExpense } from "~/modules/cash-flow/entities/dtos/MonthlyExpenseDTO";
import { Button } from "~/shared/client/components/ui/button";
import { Dialog } from "~/shared/client/components/ui/dialog";
import type { Dictionary } from "~/shared/client/i18n";

export function MonthlyExpenseDialog({
  canArchive,
  expense,
  isSubmitting,
  onClose,
  onDelete,
  onSave,
  t,
}: {
  canArchive: boolean;
  expense?: MonthlyExpense;
  isSubmitting: boolean;
  onClose: () => void;
  onDelete: () => void;
  onSave: (value: MonthlyExpenseFormValue) => void;
  t: Dictionary["billsPage"];
}) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const formId = useId();

  useEffect(() => {
    setIsConfirmingDelete(false);
  }, [canArchive, expense?.id]);

  return (
    <Dialog
      footer={
        isConfirmingDelete ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 flex items-start gap-2 text-term-red text-xs">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {t.deleteConfirmation}
            </p>
            <div className="flex shrink-0 justify-end gap-2">
              <Button
                onClick={() => setIsConfirmingDelete(false)}
                size="sm"
                type="button"
                variant="outline"
              >
                {t.cancelAction}
              </Button>
              <Button
                disabled={isSubmitting}
                onClick={onDelete}
                size="sm"
                type="button"
                variant="destructive"
              >
                {t.confirmDelete}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap justify-end gap-2 sm:justify-between">
            {canArchive && (
              <Button
                disabled={isSubmitting}
                onClick={() => setIsConfirmingDelete(true)}
                type="button"
                variant="destructive"
              >
                <Trash2 />
                {t.deleteAction}
              </Button>
            )}
            <div className="flex gap-2">
              <Button onClick={onClose} type="button" variant="outline">
                {t.cancelAction}
              </Button>
              <Button disabled={isSubmitting} form={formId} type="submit">
                {t.saveAction}
              </Button>
            </div>
          </div>
        )
      }
      onClose={onClose}
      open={expense !== undefined}
      title={expense?.name ?? t.editTitle}
    >
      <div className="p-4">
        <MonthlyExpenseForm
          expense={expense}
          formId={formId}
          hideActions
          isSubmitting={isSubmitting}
          onCancel={onClose}
          onSubmit={onSave}
          t={t}
        />
      </div>
    </Dialog>
  );
}
