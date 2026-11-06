import { AlertTriangle, Archive } from "lucide-react";
import { useId } from "react";
import { TerminalResponsiveOverlay } from "~/client/shared/components/terminal/TerminalResponsiveOverlay";
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
} from "~/client/shared/components/ui/alert-dialog";
import { Button } from "~/client/shared/components/ui/button";
import type { Dictionary } from "~/client/shared/i18n/dictionary";
import type { MonthlyExpenseDTO } from "~/contracts/http/cash-flow/monthly-expense";
import {
  MonthlyExpenseForm,
  type MonthlyExpenseFormValue,
} from "./MonthlyExpenseForm";

export function MonthlyExpenseDialog({
  bankAccounts,
  canArchive,
  categories,
  expense,
  isSubmitting,
  onClose,
  onDelete,
  onSave,
  open,
  t,
}: {
  bankAccounts: string[];
  canArchive: boolean;
  categories: string[];
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
  const title = isCreate ? t.createPrompt : t.editTitle;
  const submitLabel = isCreate ? t.createAction : t.saveAction;

  function onOpenChange(nextOpen: boolean) {
    if (!nextOpen) onClose();
  }

  return (
    <TerminalResponsiveOverlay
      bodyClassName="space-y-4"
      closeLabel={t.closeAction}
      description={expense ? expense.name : t.optionalHint}
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
                <Archive />
                {t.deleteAction}
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogMedia className="bg-destructive/10 text-destructive">
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
        bankAccounts={bankAccounts}
        categories={categories}
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
