import { CalendarDays, Landmark, Tags } from "lucide-react";
import { type SubmitEvent, useEffect, useId, useRef, useState } from "react";
import { MonetaryValue } from "~/client/shared/components/MonetaryValue";
import { MoneyInput } from "~/client/shared/components/MoneyInput";
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
import type { SyncCashFlowBankAccountRequestDTO } from "~/contracts/http/cash-flow/cash-flow";

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
  balances,
  bankAccounts,
  currency,
  hiddenMonetaryValueLabel,
  categories,
  formId,
  isSubmitting,
  onSubmit,
  open,
  t,
}: {
  balances: Record<string, number>;
  bankAccounts: string[];
  currency: Intl.NumberFormat;
  hiddenMonetaryValueLabel: string;
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
  const enteredBalance = Number(currentBalance);
  const adjustment =
    currentBalance.trim() &&
    Number.isFinite(enteredBalance) &&
    balances[bankAccount] !== undefined
      ? enteredBalance - balances[bankAccount]
      : undefined;
  let adjustmentLabel: string | undefined;
  if (adjustment !== undefined) {
    const sign = adjustment > 0 ? "+" : "";
    adjustmentLabel = `${sign}${currency.format(adjustment)}`;
  }
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
    setCategory(categories.find((item) => /adjust|ajuste/i.test(item)) ?? "");
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
            <Landmark className="size-3.5 text-muted-foreground" />
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
            {t.currentBalanceLabel}
          </FieldLabel>
          <MoneyInput
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
      {bankAccount && balances[bankAccount] !== undefined && (
        <p className="m-0 flex flex-wrap justify-between gap-x-4 gap-y-1 rounded-lg border border-border bg-muted/60 px-3 py-2 text-muted-foreground text-xs tabular-nums">
          <span>
            {t.trackedBalanceLabel}{" "}
            <strong className="font-medium text-foreground">
              <MonetaryValue hiddenLabel={hiddenMonetaryValueLabel}>
                {currency.format(balances[bankAccount])}
              </MonetaryValue>
            </strong>
          </span>
          <span>
            {t.adjustmentPreviewLabel}{" "}
            <strong className="font-medium text-foreground">
              {adjustmentLabel === undefined ? (
                "—"
              ) : (
                <MonetaryValue hiddenLabel={hiddenMonetaryValueLabel}>
                  {adjustmentLabel}
                </MonetaryValue>
              )}
            </strong>
          </span>
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={Boolean(errors.category)}>
          <FieldLabel htmlFor={`${fieldId}-category`}>
            <Tags className="size-3.5 text-muted-foreground" />
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
            <NativeSelectOption value="">{t.chooseCategory}</NativeSelectOption>
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
            <CalendarDays className="size-3.5 text-muted-foreground" />
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
