import { CalendarDays, Check, Circle, Pencil, ReceiptText } from "lucide-react";
import type { MonthlyExpense } from "~/modules/cash-flow/entities/dtos/MonthlyExpenseDTO";
import { Button } from "~/shared/client/components/ui/button";
import { cn } from "~/shared/client/components/ui/lib";
import type { Dictionary, Locale } from "~/shared/client/i18n";

export function MonthlyExpenseRow({
  expense,
  isSubmitting,
  locale,
  onEdit,
  onTogglePaid,
  t,
}: {
  expense: MonthlyExpense;
  isSubmitting: boolean;
  locale: Locale;
  onEdit: () => void;
  onTogglePaid: () => void;
  t: Dictionary["billsPage"];
}) {
  const amount = expense.expectedAmount
    ? new Intl.NumberFormat(locale === "pt-BR" ? "pt-BR" : "en-US", {
        style: "currency",
        currency: "BRL",
      }).format(expense.expectedAmount)
    : t.variableAmount;

  return (
    <article
      className={cn(
        "group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3",
        "border border-term-border border-l-2 bg-term-bg/45 p-3",
        "transition-all duration-200 hover:bg-term-chrome/70",
        expense.isPaid
          ? "border-l-term-green/70"
          : "border-l-term-amber/80 hover:border-l-term-green",
      )}
    >
      <button
        aria-label={expense.isPaid ? t.markUnpaid : t.markPaid}
        aria-pressed={expense.isPaid}
        className={cn(
          "relative z-10 flex pointer-fine:size-10 size-11 shrink-0 items-center justify-center rounded-md border",
          "transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
          expense.isPaid
            ? "border-term-green/45 bg-term-green/12 text-term-green"
            : "border-term-amber/35 bg-term-amber/8 text-term-amber hover:border-term-green/45 hover:bg-term-green/10 hover:text-term-green",
        )}
        disabled={isSubmitting}
        onClick={onTogglePaid}
        type="button"
      >
        {expense.isPaid ? (
          <Check className="size-5" />
        ) : (
          <Circle className="size-5" />
        )}
      </button>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <ReceiptText
            className={cn(
              "size-3.5 shrink-0",
              expense.isPaid ? "text-term-green/70" : "text-term-green",
            )}
          />
          <h2
            className={cn(
              "m-0 truncate font-medium text-sm",
              expense.isPaid
                ? "text-term-muted line-through decoration-term-green/45"
                : "text-term-bright",
            )}
          >
            {expense.name}
          </h2>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-term-muted">
          <span
            className={
              expense.expectedAmount ? "text-term-cyan" : "text-term-muted"
            }
          >
            {amount}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3 text-term-amber" />
            {expense.dueDay
              ? `${t.dueDayPrefix} ${expense.dueDay}`
              : t.noDueDay}
          </span>
          <span
            className={expense.isPaid ? "text-term-green" : "text-term-amber"}
          >
            {expense.isPaid ? t.paid : t.unpaid}
          </span>
        </div>
      </div>
      <Button
        aria-label={t.editAction}
        className="text-term-muted hover:text-term-cyan"
        onClick={onEdit}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <Pencil />
      </Button>
    </article>
  );
}
