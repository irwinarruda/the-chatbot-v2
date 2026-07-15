import { CalendarDays, CircleDollarSign, ReceiptText } from "lucide-react";
import { type SubmitEvent, useEffect, useId, useState } from "react";
import type { MonthlyExpense } from "~/modules/cash-flow/entities/dtos/MonthlyExpenseDTO";
import { Button } from "~/shared/client/components/ui/button";
import { Input } from "~/shared/client/components/ui/input";
import type { Dictionary } from "~/shared/client/i18n";

export interface MonthlyExpenseFormValue {
  name: string;
  expectedAmount?: number;
  dueDay?: number;
}

export function MonthlyExpenseForm({
  expense,
  isSubmitting,
  onCancel,
  onSubmit,
  t,
}: {
  expense?: MonthlyExpense;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (value: MonthlyExpenseFormValue) => void;
  t: Dictionary["billsPage"];
}) {
  const [name, setName] = useState("");
  const [expectedAmount, setExpectedAmount] = useState("");
  const [dueDay, setDueDay] = useState("");
  const fieldId = useId();

  useEffect(() => {
    setName(expense?.name ?? "");
    setExpectedAmount(expense?.expectedAmount?.toString() ?? "");
    setDueDay(expense?.dueDay?.toString() ?? "");
  }, [expense]);

  function onFormSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = expectedAmount ? Number(expectedAmount) : undefined;
    const day = dueDay ? Number(dueDay) : undefined;
    if (!name.trim()) return;
    if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
      return;
    }
    if (day !== undefined && (!Number.isInteger(day) || day < 1 || day > 31)) {
      return;
    }
    onSubmit({ name: name.trim(), expectedAmount: amount, dueDay: day });
  }

  return (
    <form className="space-y-4" onSubmit={onFormSubmit}>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_11rem_8rem]">
        <label className="space-y-1.5" htmlFor={`${fieldId}-name`}>
          <span className="flex items-center gap-1.5 text-2xs text-term-muted uppercase tracking-wide">
            <ReceiptText className="size-3.5 text-term-green" />
            {t.nameLabel}
          </span>
          <Input
            id={`${fieldId}-name`}
            maxLength={160}
            onChange={(event) => setName(event.target.value)}
            placeholder={t.namePlaceholder}
            value={name}
          />
        </label>
        <label className="space-y-1.5" htmlFor={`${fieldId}-amount`}>
          <span className="flex items-center gap-1.5 text-2xs text-term-muted uppercase tracking-wide">
            <CircleDollarSign className="size-3.5 text-term-cyan" />
            {t.amountLabel}
          </span>
          <Input
            id={`${fieldId}-amount`}
            inputMode="decimal"
            min="0.01"
            onChange={(event) => setExpectedAmount(event.target.value)}
            placeholder={t.amountPlaceholder}
            step="0.01"
            type="number"
            value={expectedAmount}
          />
        </label>
        <label className="space-y-1.5" htmlFor={`${fieldId}-due-day`}>
          <span className="flex items-center gap-1.5 text-2xs text-term-muted uppercase tracking-wide">
            <CalendarDays className="size-3.5 text-term-amber" />
            {t.dueDayLabel}
          </span>
          <Input
            id={`${fieldId}-due-day`}
            inputMode="numeric"
            max="31"
            min="1"
            onChange={(event) => setDueDay(event.target.value)}
            placeholder={t.dueDayPlaceholder}
            type="number"
            value={dueDay}
          />
        </label>
      </div>
      <p className="m-0 text-2xs text-term-muted">{t.optionalHint}</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button onClick={onCancel} type="button" variant="outline">
          {t.cancelAction}
        </Button>
        <Button disabled={isSubmitting || !name.trim()} type="submit">
          {expense ? t.saveAction : t.createAction}
        </Button>
      </div>
    </form>
  );
}
