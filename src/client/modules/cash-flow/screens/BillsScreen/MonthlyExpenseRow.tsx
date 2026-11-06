import {
  CalendarDays,
  CircleCheck,
  Landmark,
  Pencil,
  Tags,
} from "lucide-react";
import { MonetaryValue } from "~/client/shared/components/MonetaryValue";
import { Button } from "~/client/shared/components/ui/button";
import { Checkbox } from "~/client/shared/components/ui/checkbox";
import { cn } from "~/client/shared/components/ui/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/client/shared/components/ui/tooltip";
import type { Dictionary, Locale } from "~/client/shared/i18n/dictionary";
import type { MonthlyExpenseDTO } from "~/contracts/http/cash-flow/monthly-expense";

export function MonthlyExpenseRow({
  bankAccount,
  expense,
  hiddenMonetaryValueLabel,
  isSubmitting,
  locale,
  onEdit,
  onPayFromAccount,
  onTogglePaid,
  t,
}: {
  expense: MonthlyExpenseDTO;
  bankAccount?: string;
  hiddenMonetaryValueLabel: string;
  isSubmitting: boolean;
  locale: Locale;
  onEdit: () => void;
  onPayFromAccount: () => void;
  onTogglePaid: () => void;
  t: Dictionary["billsPage"];
}) {
  const amount = expense.expectedAmount
    ? new Intl.NumberFormat(locale === "pt-BR" ? "pt-BR" : "en-US", {
        style: "currency",
        currency: "BRL",
      }).format(expense.expectedAmount)
    : t.variableAmount;
  const paidLabel = expense.isPaid ? t.paid : t.unpaid;

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60">
      <Checkbox
        aria-label={expense.isPaid ? t.markUnpaid : t.markPaid}
        checked={expense.isPaid}
        className="size-5 after:-inset-3"
        disabled={isSubmitting}
        onCheckedChange={(checked) => {
          if (checked !== expense.isPaid) onTogglePaid();
        }}
      />
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 items-start gap-2">
          <h2
            className={cn(
              "m-0 min-w-0 flex-1 break-words font-medium text-sm sm:truncate",
              expense.isPaid ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {expense.name}
          </h2>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-muted-foreground text-xs">
          <span
            className={
              expense.expectedAmount
                ? "text-foreground tabular-nums"
                : "text-muted-foreground"
            }
          >
            {expense.expectedAmount ? (
              <MonetaryValue hiddenLabel={hiddenMonetaryValueLabel}>
                {amount}
              </MonetaryValue>
            ) : (
              amount
            )}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarDays aria-hidden="true" className="size-3" />
            {expense.dueDay
              ? `${t.dueDayPrefix} ${expense.dueDay}`
              : t.noDueDay}
          </span>
          {expense.category !== undefined && (
            <span className="inline-flex min-w-0 max-w-full items-center gap-1">
              <Tags aria-hidden="true" className="size-3 shrink-0" />
              <span className="sr-only">{t.categoryLabel}:</span>
              <span className="truncate" title={expense.category}>
                {expense.category}
              </span>
            </span>
          )}
          {expense.isPaid && (
            <span className="inline-flex items-center gap-1 text-success">
              <CircleCheck aria-hidden="true" className="size-3" />
              {paidLabel}
            </span>
          )}
          {bankAccount && (
            <span className="inline-flex min-w-0 max-w-full items-center gap-1">
              <Landmark aria-hidden="true" className="size-3 shrink-0" />
              <span className="truncate" title={bankAccount}>
                {t.paymentRecorded} {bankAccount}
              </span>
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0.5">
        {!expense.isPaid && !bankAccount && Boolean(expense.expectedAmount) && (
          <Button
            aria-label={t.payFromAccount}
            disabled={isSubmitting}
            onClick={onPayFromAccount}
            size="sm"
            type="button"
            variant="outline"
          >
            <Landmark />
            {t.payAction}
          </Button>
        )}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={t.editAction}
                className="text-muted-foreground"
                disabled={isSubmitting}
                onClick={onEdit}
                size="icon-sm"
                type="button"
                variant="ghost"
              />
            }
          >
            <Pencil />
          </TooltipTrigger>
          <TooltipContent>{t.editAction}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
