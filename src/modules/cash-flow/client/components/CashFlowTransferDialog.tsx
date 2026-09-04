import {
  ArrowRight,
  ArrowRightLeft,
  CalendarDays,
  Landmark,
} from "lucide-react";
import { type SubmitEvent, useId, useState } from "react";
import { SaveCashFlowTransferRequestDTO } from "~/modules/cash-flow/entities/dtos/CashFlowTransferDTO";
import { TerminalResponsiveOverlay } from "~/shared/client/components/terminal/TerminalResponsiveOverlay";
import { Alert, AlertDescription } from "~/shared/client/components/ui/alert";
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

export function CashFlowTransferDialog({
  bankAccounts,
  initialValue,
  isEditing,
  isSubmitting,
  error,
  onClose,
  onSave,
  t,
}: {
  bankAccounts: string[];
  initialValue: SaveCashFlowTransferRequestDTO;
  isEditing: boolean;
  isSubmitting: boolean;
  error?: string;
  onClose: () => void;
  onSave: (value: SaveCashFlowTransferRequestDTO) => void;
  t: Dictionary["cashFlowPage"];
}) {
  const formId = useId();
  const [from, setFrom] = useState(initialValue.from);
  const [to, setTo] = useState(initialValue.to);
  const [value, setValue] = useState(
    initialValue.value ? String(initialValue.value) : "",
  );
  const [date, setDate] = useState(initialValue.date);
  const [description, setDescription] = useState(initialValue.description);
  const [validationError, setValidationError] = useState(false);
  const sameAccount = Boolean(from && from === to);

  function onFormSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = SaveCashFlowTransferRequestDTO.safeParse({
      id: initialValue.id,
      from,
      to,
      value: Number(value),
      date,
      description,
    });
    setValidationError(!parsed.success);
    if (parsed.success) onSave(parsed.data);
  }

  return (
    <TerminalResponsiveOverlay
      closeLabel={t.cancelAction}
      description={t.transferHint}
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
            disabled={isSubmitting || bankAccounts.length < 2 || sameAccount}
            form={formId}
            type="submit"
          >
            <ArrowRightLeft />
            {t.transferSaveAction}
          </Button>
        </div>
      }
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose();
      }}
      open
      title={isEditing ? t.transferEditAction : t.transferAction}
    >
      <form
        aria-busy={isSubmitting}
        className="space-y-4"
        id={formId}
        onSubmit={onFormSubmit}
      >
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {bankAccounts.length < 2 && (
          <Alert>
            <AlertDescription>{t.transferAccountsHint}</AlertDescription>
          </Alert>
        )}
        <fieldset className="space-y-4" disabled={isSubmitting}>
          <div className="grid items-start gap-3 rounded-lg border border-term-cyan/20 bg-term-cyan/5 p-3 sm:grid-cols-[1fr_auto_1fr]">
            <Field>
              <FieldLabel htmlFor={`${formId}-from`}>
                <Landmark className="size-3.5 text-term-cyan" />
                {t.sourceAccountLabel}
              </FieldLabel>
              <NativeSelect
                className="w-full"
                id={`${formId}-from`}
                onChange={(event) => setFrom(event.target.value)}
                required
                value={from}
              >
                <NativeSelectOption value="">
                  {t.selectAccount}
                </NativeSelectOption>
                {bankAccounts.map((account) => (
                  <NativeSelectOption key={account} value={account}>
                    {account}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <ArrowRight
              aria-hidden="true"
              className="hidden size-4 self-center text-term-cyan sm:block"
            />
            <Field data-invalid={sameAccount}>
              <FieldLabel htmlFor={`${formId}-to`}>
                <Landmark className="size-3.5 text-term-cyan" />
                {t.destinationAccountLabel}
              </FieldLabel>
              <NativeSelect
                aria-invalid={sameAccount}
                className="w-full"
                id={`${formId}-to`}
                onChange={(event) => setTo(event.target.value)}
                required
                value={to}
              >
                <NativeSelectOption value="">
                  {t.selectAccount}
                </NativeSelectOption>
                {bankAccounts.map((account) => (
                  <NativeSelectOption
                    disabled={account === from}
                    key={account}
                    value={account}
                  >
                    {account}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {sameAccount && <FieldError>{t.sameAccountError}</FieldError>}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`${formId}-amount`}>
                {t.amountLabel}
              </FieldLabel>
              <Input
                id={`${formId}-amount`}
                inputMode="decimal"
                min="0.01"
                onChange={(event) => setValue(event.target.value)}
                placeholder={t.amountPlaceholder}
                required
                step="0.01"
                type="number"
                value={value}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${formId}-date`}>
                <CalendarDays className="size-3.5 text-term-amber" />
                {t.dateLabel}
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
          <Field>
            <FieldLabel htmlFor={`${formId}-description`}>
              {t.optionalDescription}
            </FieldLabel>
            <Input
              id={`${formId}-description`}
              maxLength={160}
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
          </Field>
        </fieldset>
        {validationError && (
          <FieldError>{t.transferValidationError}</FieldError>
        )}
      </form>
    </TerminalResponsiveOverlay>
  );
}
