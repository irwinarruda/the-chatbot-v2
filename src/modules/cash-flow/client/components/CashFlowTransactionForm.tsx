import {
  BanknoteArrowDown,
  BanknoteArrowUp,
  CalendarDays,
  CircleDollarSign,
  Landmark,
  Tags,
} from "lucide-react";
import { type SubmitEvent, useEffect, useId, useRef, useState } from "react";
import type { CreateCashFlowTransactionRequestDTO } from "~/modules/cash-flow/entities/dtos/CashFlowWebDTO";
import { CashFlowTransactionType } from "~/modules/cash-flow/entities/enums/CashFlowTransactionType";
import { Button } from "~/shared/client/components/ui/button";
import {
  Field,
  FieldError,
  FieldLabel,
} from "~/shared/client/components/ui/field";
import { Input } from "~/shared/client/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/shared/client/components/ui/native-select";
import type { Dictionary } from "~/shared/client/i18n";

type TransactionFormErrors = {
  value?: string;
  description?: string;
  bankAccount?: string;
  category?: string;
};

const todayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function CashFlowTransactionForm({
  bankAccounts,
  earningCategories,
  expenseCategories,
  formId,
  isSubmitting,
  onSubmit,
  open,
  t,
}: {
  bankAccounts: string[];
  earningCategories: string[];
  expenseCategories: string[];
  formId: string;
  isSubmitting: boolean;
  onSubmit: (value: CreateCashFlowTransactionRequestDTO) => void;
  open: boolean;
  t: Dictionary["cashFlowPage"];
}) {
  const [type, setType] = useState<CashFlowTransactionType>(
    CashFlowTransactionType.Expense,
  );
  const [date, setDate] = useState(todayFormatter.format(new Date()));
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [category, setCategory] = useState("");
  const [errors, setErrors] = useState<TransactionFormErrors>({});
  const fieldId = useId();
  const valueRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const categories =
    type === CashFlowTransactionType.Expense
      ? expenseCategories
      : earningCategories;

  function onTypeSelect(nextType: CashFlowTransactionType) {
    setType(nextType);
    const nextCategories =
      nextType === CashFlowTransactionType.Expense
        ? expenseCategories
        : earningCategories;
    setCategory(nextCategories[0] ?? "");
    setErrors((current) => ({ ...current, category: undefined }));
  }

  function onFormSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericValue = Number(value);
    const nextErrors: TransactionFormErrors = {};
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      nextErrors.value = t.positiveAmountError;
    }
    if (!description.trim()) nextErrors.description = t.requiredFieldError;
    if (!bankAccount) nextErrors.bankAccount = t.requiredFieldError;
    if (!category) nextErrors.category = t.requiredFieldError;
    setErrors(nextErrors);
    if (nextErrors.value) {
      valueRef.current?.focus();
      return;
    }
    if (nextErrors.description) {
      descriptionRef.current?.focus();
      return;
    }
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit({
      type,
      date,
      value: numericValue,
      category,
      description: description.trim(),
      bankAccount,
    });
  }

  useEffect(() => {
    if (!open) return;
    setType(CashFlowTransactionType.Expense);
    setDate(todayFormatter.format(new Date()));
    setValue("");
    setDescription("");
    setBankAccount(bankAccounts[0] ?? "");
    setCategory(expenseCategories[0] ?? "");
    setErrors({});
  }, [open, bankAccounts, expenseCategories]);

  return (
    <form
      aria-busy={isSubmitting}
      className="space-y-4"
      id={formId}
      noValidate
      onSubmit={onFormSubmit}
    >
      <Field>
        <FieldLabel>{t.transactionTypeLabel}</FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          <Button
            aria-pressed={type === CashFlowTransactionType.Expense}
            className="aria-pressed:border-term-red/35 aria-pressed:bg-term-red/10 aria-pressed:text-term-red"
            onClick={() => onTypeSelect(CashFlowTransactionType.Expense)}
            type="button"
            variant="outline"
          >
            <BanknoteArrowDown />
            {t.expense}
          </Button>
          <Button
            aria-pressed={type === CashFlowTransactionType.Earning}
            className="aria-pressed:border-term-green/35 aria-pressed:bg-term-green/10 aria-pressed:text-term-green"
            onClick={() => onTypeSelect(CashFlowTransactionType.Earning)}
            type="button"
            variant="outline"
          >
            <BanknoteArrowUp />
            {t.earning}
          </Button>
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={Boolean(errors.value)}>
          <FieldLabel htmlFor={`${fieldId}-value`}>
            <CircleDollarSign className="size-3.5 text-term-cyan" />
            {t.amountLabel}
          </FieldLabel>
          <Input
            aria-invalid={Boolean(errors.value)}
            id={`${fieldId}-value`}
            inputMode="decimal"
            min="0.01"
            onChange={(event) => {
              setValue(event.target.value);
              setErrors((current) => ({ ...current, value: undefined }));
            }}
            placeholder={t.amountPlaceholder}
            ref={valueRef}
            required
            step="0.01"
            type="number"
            value={value}
          />
          <FieldError>{errors.value}</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${fieldId}-date`}>
            <CalendarDays className="size-3.5 text-term-amber" />
            {t.dateLabel}
          </FieldLabel>
          <Input
            id={`${fieldId}-date`}
            onChange={(event) => setDate(event.target.value)}
            required
            type="date"
            value={date}
          />
        </Field>
      </div>
      <Field data-invalid={Boolean(errors.description)}>
        <FieldLabel htmlFor={`${fieldId}-description`}>
          {t.descriptionLabel}
        </FieldLabel>
        <Input
          aria-invalid={Boolean(errors.description)}
          id={`${fieldId}-description`}
          maxLength={160}
          onChange={(event) => {
            setDescription(event.target.value);
            setErrors((current) => ({ ...current, description: undefined }));
          }}
          placeholder={t.descriptionPlaceholder}
          ref={descriptionRef}
          required
          value={description}
        />
        <FieldError>{errors.description}</FieldError>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={Boolean(errors.bankAccount)}>
          <FieldLabel htmlFor={`${fieldId}-account`}>
            <Landmark className="size-3.5 text-term-blue" />
            {t.bankAccountLabel}
          </FieldLabel>
          <NativeSelect
            aria-invalid={Boolean(errors.bankAccount)}
            className="w-full"
            id={`${fieldId}-account`}
            onChange={(event) => {
              setBankAccount(event.target.value);
              setErrors((current) => ({
                ...current,
                bankAccount: undefined,
              }));
            }}
            required
            value={bankAccount}
          >
            {bankAccounts.map((account) => (
              <NativeSelectOption key={account} value={account}>
                {account}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldError>{errors.bankAccount}</FieldError>
        </Field>
        <Field data-invalid={Boolean(errors.category)}>
          <FieldLabel htmlFor={`${fieldId}-category`}>
            <Tags className="size-3.5 text-term-magenta" />
            {t.categoryLabel}
          </FieldLabel>
          <NativeSelect
            aria-invalid={Boolean(errors.category)}
            className="w-full"
            id={`${fieldId}-category`}
            onChange={(event) => {
              setCategory(event.target.value);
              setErrors((current) => ({ ...current, category: undefined }));
            }}
            required
            value={category}
          >
            {categories.map((item) => (
              <NativeSelectOption key={item} value={item}>
                {item}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldError>{errors.category}</FieldError>
        </Field>
      </div>
    </form>
  );
}
