import {
  CalendarDays,
  CircleDollarSign,
  Landmark,
  ReceiptText,
  Tags,
} from "lucide-react";
import { type SubmitEvent, useEffect, useId, useRef, useState } from "react";
import { MoneyInput } from "~/client/shared/components/MoneyInput";
import { Button } from "~/client/shared/components/ui/button";
import {
  Field,
  FieldError,
  FieldLabel,
} from "~/client/shared/components/ui/field";
import { Input } from "~/client/shared/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/client/shared/components/ui/native-select";
import type { Dictionary } from "~/client/shared/i18n/dictionary";
import type { MonthlyExpenseDTO } from "~/contracts/http/cash-flow/monthly-expense";

export interface MonthlyExpenseFormValue {
  name: string;
  expectedAmount?: number;
  dueDay?: number;
  category?: string;
  defaultBankAccount?: string;
}

type MonthlyExpenseFormErrors = {
  name?: string;
  expectedAmount?: string;
  dueDay?: string;
};

export function MonthlyExpenseForm({
  bankAccounts,
  categories,
  expense,
  formId,
  hideActions = false,
  isSubmitting,
  onCancel,
  onSubmit,
  t,
}: {
  bankAccounts: string[];
  categories: string[];
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
  const [category, setCategory] = useState("");
  const [defaultBankAccount, setDefaultBankAccount] = useState("");
  const [errors, setErrors] = useState<MonthlyExpenseFormErrors>({});
  const fieldId = useId();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const dueDayInputRef = useRef<HTMLInputElement>(null);
  const nameId = `${fieldId}-name`;
  const amountId = `${fieldId}-amount`;
  const dueDayId = `${fieldId}-due-day`;
  const categoryId = `${fieldId}-category`;
  const defaultBankAccountId = `${fieldId}-default-bank-account`;
  const categoryOptions = withSavedOption(categories, expense?.category);
  const bankAccountOptions = withSavedOption(
    bankAccounts,
    expense?.defaultBankAccount,
  );
  const optionalHintId = `${fieldId}-optional-hint`;

  useEffect(() => {
    setName(expense?.name ?? "");
    setExpectedAmount(expense?.expectedAmount?.toFixed(2) ?? "");
    setDueDay(expense?.dueDay?.toString() ?? "");
    setCategory(expense?.category ?? "");
    setDefaultBankAccount(expense?.defaultBankAccount ?? "");
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

    onSubmit({
      name: name.trim(),
      expectedAmount: amount,
      dueDay: day,
      category: category || undefined,
      defaultBankAccount: defaultBankAccount || undefined,
    });
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
            className="font-medium text-foreground text-sm"
            htmlFor={nameId}
          >
            <ReceiptText
              aria-hidden="true"
              className="size-3.5 text-muted-foreground"
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
            className="font-medium text-foreground text-sm"
            htmlFor={amountId}
          >
            <CircleDollarSign
              aria-hidden="true"
              className="size-3.5 text-muted-foreground"
            />
            {t.amountLabel}
          </FieldLabel>
          <MoneyInput
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
            className="font-medium text-foreground text-sm"
            htmlFor={dueDayId}
          >
            <CalendarDays
              aria-hidden="true"
              className="size-3.5 text-muted-foreground"
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
        <Field>
          <FieldLabel
            className="font-medium text-foreground text-sm"
            htmlFor={categoryId}
          >
            <Tags
              aria-hidden="true"
              className="size-3.5 text-muted-foreground"
            />
            {t.categoryLabel}
          </FieldLabel>
          <NativeSelect
            aria-describedby={!hideActions ? optionalHintId : undefined}
            className="w-full"
            id={categoryId}
            onChange={(event) => setCategory(event.target.value)}
            value={category}
          >
            <NativeSelectOption value="">{t.noCategory}</NativeSelectOption>
            {categoryOptions.map((item) => (
              <NativeSelectOption key={item} value={item}>
                {item}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel
            className="font-medium text-foreground text-sm"
            htmlFor={defaultBankAccountId}
          >
            <Landmark
              aria-hidden="true"
              className="size-3.5 text-muted-foreground"
            />
            {t.defaultBankAccountLabel}
          </FieldLabel>
          <NativeSelect
            aria-describedby={!hideActions ? optionalHintId : undefined}
            className="w-full"
            id={defaultBankAccountId}
            onChange={(event) => setDefaultBankAccount(event.target.value)}
            value={defaultBankAccount}
          >
            <NativeSelectOption value="">
              {t.noDefaultBankAccount}
            </NativeSelectOption>
            {bankAccountOptions.map((item) => (
              <NativeSelectOption key={item} value={item}>
                {item}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>
      {!hideActions && (
        <p
          className="m-0 font-sans text-muted-foreground text-xs"
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

function withSavedOption(options: string[], saved?: string): string[] {
  if (!saved || options.includes(saved)) return options;
  return [saved, ...options];
}
