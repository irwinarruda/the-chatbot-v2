import { AlertTriangle, Trash2 } from "lucide-react";
import { useId } from "react";
import {
  MonthlyExpenseForm,
  type MonthlyExpenseFormValue,
} from "~/modules/cash-flow/client/components/MonthlyExpenseForm";
import type { MonthlyExpenseDTO } from "~/modules/cash-flow/entities/dtos/MonthlyExpenseDTO";
import { TerminalResponsiveOverlay } from "~/shared/client/components/terminal/TerminalResponsiveOverlay";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/shared/client/components/ui/alert-dialog";
import { Button } from "~/shared/client/components/ui/button";
import type { Dictionary } from "~/shared/client/i18n";

export function MonthlyExpenseDialog({
  canArchive,
  expense,
  isSubmitting,
  onClose,
  onDelete,
  onSave,
  open,
  t,
}: {
  canArchive: boolean;
  expense?: MonthlyExpenseDTO;
  isSubmitting: boolean;
  onClose: () => void;
  onDelete: () => void;
  onSave: (value: MonthlyExpenseFormValue) => void;
  open: boolean;
  t: Dictionary["billsPage"];
}) {
  const formId = useId();
  const isCreate = expense === undefined;
  const title = isCreate ? t.createPrompt : (expense.name ?? t.editTitle);
  const submitLabel = isCreate ? t.createAction : t.saveAction;

  function onOpenChange(nextOpen: boolean) {
    if (!nextOpen) onClose();
  }

  return (
    <TerminalResponsiveOverlay
      bodyClassName="space-y-4"
      closeLabel={t.cancelAction}
      description={t.optionalHint}
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          {!isCreate && canArchive && (
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    className="w-full font-sans sm:w-auto"
                    disabled={isSubmitting}
                    type="button"
                    variant="destructive"
                  />
                }
              >
                <Trash2 />
                {t.deleteAction}
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogMedia className="bg-term-red/10 text-term-red">
                    <AlertTriangle />
                  </AlertDialogMedia>
                  <AlertDialogTitle className="font-sans">
                    {t.deleteAction}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="font-sans">
                    {t.deleteConfirmation}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel
                    className="font-sans"
                    disabled={isSubmitting}
                  >
                    {t.cancelAction}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="font-sans"
                    disabled={isSubmitting}
                    onClick={onDelete}
                    variant="destructive"
                  >
                    {t.confirmDelete}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <div className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:flex sm:w-auto">
            <Button
              className="font-sans"
              onClick={onClose}
              type="button"
              variant="outline"
            >
              {t.cancelAction}
            </Button>
            <Button
              className="font-sans"
              disabled={isSubmitting}
              form={formId}
              type="submit"
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={title}
    >
      <MonthlyExpenseForm
        expense={expense}
        formId={formId}
        hideActions
        isSubmitting={isSubmitting}
        key={expense?.id ?? "create"}
        onCancel={onClose}
        onSubmit={onSave}
        t={t}
      />
    </TerminalResponsiveOverlay>
  );
}
