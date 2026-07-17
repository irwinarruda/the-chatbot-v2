import { CalendarDays, CircleDollarSign, ReceiptText } from "lucide-react";
import { type SubmitEvent, useEffect, useId, useRef, useState } from "react";
import type { MonthlyExpenseDTO } from "~/modules/cash-flow/entities/dtos/MonthlyExpenseDTO";
import { Button } from "~/shared/client/components/ui/button";
import {
  Field,
  FieldError,
  FieldLabel,
} from "~/shared/client/components/ui/field";
import { Input } from "~/shared/client/components/ui/input";
import type { Dictionary } from "~/shared/client/i18n";

export interface MonthlyExpenseFormValue {
  name: string;
  expectedAmount?: number;
  dueDay?: number;
}

type MonthlyExpenseFormErrors = {
  name?: string;
  expectedAmount?: string;
  dueDay?: string;
};

export function MonthlyExpenseForm({
  expense,
  formId,
  hideActions = false,
  isSubmitting,
  onCancel,
  onSubmit,
  t,
}: {
  expense?: MonthlyExpenseDTO;
  formId?: string;
  hideActions?: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (value: MonthlyExpenseFormValue) => void;
  t: Dictionary["billsPage"];
}) {
  const [name, setName] = useState("");
  const [expectedAmount, setExpectedAmount] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [errors, setErrors] = useState<MonthlyExpenseFormErrors>({});
  const fieldId = useId();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const dueDayInputRef = useRef<HTMLInputElement>(null);
  const nameId = `${fieldId}-name`;
  const amountId = `${fieldId}-amount`;
  const dueDayId = `${fieldId}-due-day`;
  const optionalHintId = `${fieldId}-optional-hint`;

  useEffect(() => {
    setName(expense?.name ?? "");
    setExpectedAmount(expense?.expectedAmount?.toString() ?? "");
    setDueDay(expense?.dueDay?.toString() ?? "");
    setErrors({});
  }, [expense]);

  function onFormSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = expectedAmount ? Number(expectedAmount) : undefined;
    const day = dueDay ? Number(dueDay) : undefined;
    const nextErrors: MonthlyExpenseFormErrors = {};

    if (!name.trim()) {
      nextErrors.name = `${t.nameLabel}: ${t.namePlaceholder}`;
    }
    if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
      nextErrors.expectedAmount =
        amountInputRef.current?.validationMessage ||
        `${t.amountLabel}: ${t.amountPlaceholder}`;
    }
    if (day !== undefined && (!Number.isInteger(day) || day < 1 || day > 31)) {
      nextErrors.dueDay =
        dueDayInputRef.current?.validationMessage ||
        `${t.dueDayLabel}: ${t.dueDayPlaceholder}`;
    }

    setErrors(nextErrors);
    if (nextErrors.name) {
      nameInputRef.current?.focus();
      return;
    }
    if (nextErrors.expectedAmount) {
      amountInputRef.current?.focus();
      return;
    }
    if (nextErrors.dueDay) {
      dueDayInputRef.current?.focus();
      return;
    }

    onSubmit({ name: name.trim(), expectedAmount: amount, dueDay: day });
  }

  return (
    <form
      aria-busy={isSubmitting}
      className="space-y-4"
      id={formId}
      noValidate
      onSubmit={onFormSubmit}
    >
      <div className="grid gap-4">
        <Field data-invalid={Boolean(errors.name)}>
          <FieldLabel
            className="font-sans text-term-muted text-xs uppercase tracking-wide"
            htmlFor={nameId}
          >
            <ReceiptText
              aria-hidden="true"
              className="size-3.5 text-term-green"
            />
            {t.nameLabel}
          </FieldLabel>
          <Input
            aria-describedby={errors.name ? `${nameId}-error` : undefined}
            aria-invalid={Boolean(errors.name)}
            id={nameId}
            maxLength={160}
            onChange={(event) => {
              setName(event.target.value);
              setErrors((current) => ({ ...current, name: undefined }));
            }}
            placeholder={t.namePlaceholder}
            ref={nameInputRef}
            required
            value={name}
          />
          <FieldError className="font-sans text-xs" id={`${nameId}-error`}>
            {errors.name}
          </FieldError>
        </Field>
        <Field data-invalid={Boolean(errors.expectedAmount)}>
          <FieldLabel
            className="font-sans text-term-muted text-xs uppercase tracking-wide"
            htmlFor={amountId}
          >
            <CircleDollarSign
              aria-hidden="true"
              className="size-3.5 text-term-cyan"
            />
            {t.amountLabel}
          </FieldLabel>
          <Input
            aria-describedby={
              [
                !hideActions ? optionalHintId : undefined,
                errors.expectedAmount ? `${amountId}-error` : undefined,
              ]
                .filter(Boolean)
                .join(" ") || undefined
            }
            aria-invalid={Boolean(errors.expectedAmount)}
            id={amountId}
            inputMode="decimal"
            min="0.01"
            onChange={(event) => {
              setExpectedAmount(event.target.value);
              setErrors((current) => ({
                ...current,
                expectedAmount: undefined,
              }));
            }}
            placeholder={t.amountPlaceholder}
            ref={amountInputRef}
            step="0.01"
            type="number"
            value={expectedAmount}
          />
          <FieldError className="font-sans text-xs" id={`${amountId}-error`}>
            {errors.expectedAmount}
          </FieldError>
        </Field>
        <Field data-invalid={Boolean(errors.dueDay)}>
          <FieldLabel
            className="font-sans text-term-muted text-xs uppercase tracking-wide"
            htmlFor={dueDayId}
          >
            <CalendarDays
              aria-hidden="true"
              className="size-3.5 text-term-amber"
            />
            {t.dueDayLabel}
          </FieldLabel>
          <Input
            aria-describedby={
              [
                !hideActions ? optionalHintId : undefined,
                errors.dueDay ? `${dueDayId}-error` : undefined,
              ]
                .filter(Boolean)
                .join(" ") || undefined
            }
            aria-invalid={Boolean(errors.dueDay)}
            id={dueDayId}
            inputMode="numeric"
            max="31"
            min="1"
            onChange={(event) => {
              setDueDay(event.target.value);
              setErrors((current) => ({ ...current, dueDay: undefined }));
            }}
            placeholder={t.dueDayPlaceholder}
            ref={dueDayInputRef}
            step="1"
            type="number"
            value={dueDay}
          />
          <FieldError className="font-sans text-xs" id={`${dueDayId}-error`}>
            {errors.dueDay}
          </FieldError>
        </Field>
      </div>
      {!hideActions && (
        <p
          className="m-0 font-sans text-term-muted text-xs"
          id={optionalHintId}
        >
          {t.optionalHint}
        </p>
      )}
      {!hideActions && (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            className="font-sans"
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            {t.cancelAction}
          </Button>
          <Button className="font-sans" disabled={isSubmitting} type="submit">
            {expense ? t.saveAction : t.createAction}
          </Button>
        </div>
      )}
    </form>
  );
}
