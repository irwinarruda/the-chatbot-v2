import { CalendarDays, CircleDollarSign, Landmark, Tags } from "lucide-react";
import { type SubmitEvent, useEffect, useId, useRef, useState } from "react";
import type { SyncCashFlowBankAccountRequestDTO } from "~/modules/cash-flow/entities/dtos/CashFlowWebDTO";
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

type SyncFormErrors = {
  currentBalance?: string;
  bankAccount?: string;
  category?: string;
  description?: string;
};

const todayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function CashFlowSyncForm({
  bankAccounts,
  categories,
  formId,
  isSubmitting,
  onSubmit,
  open,
  t,
}: {
  bankAccounts: string[];
  categories: string[];
  formId: string;
  isSubmitting: boolean;
  onSubmit: (value: SyncCashFlowBankAccountRequestDTO) => void;
  open: boolean;
  t: Dictionary["cashFlowPage"];
}) {
  const [bankAccount, setBankAccount] = useState("");
  const [currentBalance, setCurrentBalance] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayFormatter.format(new Date()));
  const [errors, setErrors] = useState<SyncFormErrors>({});
  const fieldId = useId();
  const balanceRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);

  function onFormSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedBalance = currentBalance.trim();
    const numericBalance = Number(normalizedBalance);
    const nextErrors: SyncFormErrors = {};
    if (!normalizedBalance || !Number.isFinite(numericBalance)) {
      nextErrors.currentBalance = t.invalidBalanceError;
    }
    if (!bankAccount) nextErrors.bankAccount = t.requiredFieldError;
    if (!category) nextErrors.category = t.requiredFieldError;
    if (!description.trim()) nextErrors.description = t.requiredFieldError;
    setErrors(nextErrors);
    if (nextErrors.currentBalance) {
      balanceRef.current?.focus();
      return;
    }
    if (nextErrors.description) {
      descriptionRef.current?.focus();
      return;
    }
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit({
      date,
      currentBalance: numericBalance,
      category,
      description: description.trim(),
      bankAccount,
    });
  }

  useEffect(() => {
    if (!open) return;
    setBankAccount(bankAccounts[0] ?? "");
    setCurrentBalance("");
    setCategory(categories[0] ?? "");
    setDescription(t.syncDescriptionDefault);
    setDate(todayFormatter.format(new Date()));
    setErrors({});
  }, [open, bankAccounts, categories, t.syncDescriptionDefault]);

  return (
    <form
      aria-busy={isSubmitting}
      className="space-y-4"
      id={formId}
      noValidate
      onSubmit={onFormSubmit}
    >
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
        <Field data-invalid={Boolean(errors.currentBalance)}>
          <FieldLabel htmlFor={`${fieldId}-balance`}>
            <CircleDollarSign className="size-3.5 text-term-cyan" />
            {t.currentBalanceLabel}
          </FieldLabel>
          <Input
            aria-invalid={Boolean(errors.currentBalance)}
            id={`${fieldId}-balance`}
            inputMode="decimal"
            onChange={(event) => {
              setCurrentBalance(event.target.value);
              setErrors((current) => ({
                ...current,
                currentBalance: undefined,
              }));
            }}
            placeholder={t.balancePlaceholder}
            ref={balanceRef}
            required
            step="0.01"
            type="number"
            value={currentBalance}
          />
          <FieldError>{errors.currentBalance}</FieldError>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={Boolean(errors.category)}>
          <FieldLabel htmlFor={`${fieldId}-category`}>
            <Tags className="size-3.5 text-term-magenta" />
            {t.adjustmentCategoryLabel}
          </FieldLabel>
          <NativeSelect
            aria-invalid={Boolean(errors.category)}
            className="w-full"
            id={`${fieldId}-category`}
            onChange={(event) => {
              setCategory(event.target.value);
              setErrors((current) => ({ ...current, category: undefined }));
            }}
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
          ref={descriptionRef}
          required
          value={description}
        />
        <FieldError>{errors.description}</FieldError>
      </Field>
    </form>
  );
}
