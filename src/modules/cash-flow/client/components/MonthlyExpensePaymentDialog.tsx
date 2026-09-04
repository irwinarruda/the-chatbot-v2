import { CalendarDays, Landmark, Tags } from "lucide-react";
import { type SubmitEvent, useId, useState } from "react";
import type {
  MonthlyExpenseDTO,
  PayMonthlyExpenseRequestDTO,
} from "~/modules/cash-flow/entities/dtos/MonthlyExpenseDTO";
import { formatCashFlowDate } from "~/modules/cash-flow/utils/CashFlowDate";
import { MonetaryValue } from "~/shared/client/components/MonetaryValue";
import { TerminalResponsiveOverlay } from "~/shared/client/components/terminal/TerminalResponsiveOverlay";
import { Alert, AlertDescription } from "~/shared/client/components/ui/alert";
import { Button } from "~/shared/client/components/ui/button";
import { Field, FieldLabel } from "~/shared/client/components/ui/field";
import { Input } from "~/shared/client/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/shared/client/components/ui/native-select";
import { Skeleton } from "~/shared/client/components/ui/skeleton";
import type { Dictionary, Locale } from "~/shared/client/i18n";

export function MonthlyExpensePaymentDialog({
  expense,
  bankAccounts,
  categories,
  isLoading,
  isSubmitting,
  loadError,
  paymentError,
  onClose,
  onSave,
  hiddenMonetaryValueLabel,
  locale,
  t,
}: {
  expense: MonthlyExpenseDTO;
  bankAccounts: string[];
  categories: string[];
  isLoading: boolean;
  isSubmitting: boolean;
  loadError: boolean;
  paymentError: boolean;
  onClose: () => void;
  onSave: (dto: PayMonthlyExpenseRequestDTO) => void;
  hiddenMonetaryValueLabel: string;
  locale: Locale;
  t: Dictionary["billsPage"];
}) {
  const formId = useId();
  const [bankAccount, setBankAccount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(formatCashFlowDate(new Date()));
  const selectedCategory = category || categories[0] || "";
  const unavailable = bankAccounts.length === 0 || categories.length === 0;
  const amount = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "BRL",
  }).format(expense.expectedAmount ?? 0);

  function onFormSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !bankAccount ||
      !selectedCategory ||
      isLoading ||
      loadError ||
      isSubmitting
    )
      return;
    onSave({
      bankAccount,
      category: selectedCategory,
      date,
      month: expense.month,
    });
  }

  return (
    <TerminalResponsiveOverlay
      closeLabel={t.cancelAction}
      description={t.paymentHint}
      footer={
        <div className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:flex sm:w-auto">
          <Button
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
            variant="outline"
          >
            {t.cancelAction}
          </Button>
          <Button
            disabled={
              isSubmitting ||
              isLoading ||
              loadError ||
              unavailable ||
              !bankAccount
            }
            form={formId}
            type="submit"
          >
            <Landmark />
            {t.paymentConfirm}
          </Button>
        </div>
      }
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose();
      }}
      open
      title={t.payFromAccount}
    >
      <form
        aria-busy={isSubmitting || isLoading}
        className="space-y-4"
        id={formId}
        onSubmit={onFormSubmit}
      >
        <div className="flex items-center justify-between gap-4 rounded-lg border border-term-green/20 bg-term-green/5 p-3">
          <span className="min-w-0 break-words font-medium text-term-bright">
            {expense.name}
          </span>
          <strong className="shrink-0 text-term-green tabular-nums">
            <MonetaryValue hiddenLabel={hiddenMonetaryValueLabel}>
              {amount}
            </MonetaryValue>
          </strong>
        </div>
        {paymentError && (
          <Alert variant="destructive">
            <AlertDescription>{t.paymentError}</AlertDescription>
          </Alert>
        )}
        {isLoading ? (
          <div aria-live="polite" className="space-y-3">
            <p className="text-sm text-term-muted">{t.paymentLoading}</p>
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : loadError ? (
          <Alert variant="destructive">
            <AlertDescription>{t.paymentLoadError}</AlertDescription>
          </Alert>
        ) : unavailable ? (
          <Alert>
            <AlertDescription>{t.paymentNoAccounts}</AlertDescription>
          </Alert>
        ) : (
          <fieldset className="space-y-4" disabled={isSubmitting}>
            <Field>
              <FieldLabel htmlFor={`${formId}-account`}>
                <Landmark className="size-3.5 text-term-blue" />
                {t.paymentAccountLabel}
              </FieldLabel>
              <NativeSelect
                className="w-full"
                id={`${formId}-account`}
                onChange={(event) => setBankAccount(event.target.value)}
                required
                value={bankAccount}
              >
                <NativeSelectOption value="">
                  {t.paymentSelectAccount}
                </NativeSelectOption>
                {bankAccounts.map((account) => (
                  <NativeSelectOption key={account} value={account}>
                    {account}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`${formId}-category`}>
                  <Tags className="size-3.5 text-term-magenta" />
                  {t.paymentCategoryLabel}
                </FieldLabel>
                <NativeSelect
                  className="w-full"
                  id={`${formId}-category`}
                  onChange={(event) => setCategory(event.target.value)}
                  required
                  value={selectedCategory}
                >
                  {categories.map((item) => (
                    <NativeSelectOption key={item} value={item}>
                      {item}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${formId}-date`}>
                  <CalendarDays className="size-3.5 text-term-amber" />
                  {t.paymentDateLabel}
                </FieldLabel>
                <Input
                  id={`${formId}-date`}
                  onChange={(event) => setDate(event.target.value)}
                  required
                  type="date"
                  value={date}
                />
              </Field>
            </div>
          </fieldset>
        )}
      </form>
    </TerminalResponsiveOverlay>
  );
}
