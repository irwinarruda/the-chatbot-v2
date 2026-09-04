import { CalendarDays, Landmark, Pencil, ReceiptText } from "lucide-react";
import type { MonthlyExpenseDTO } from "~/modules/cash-flow/entities/dtos/MonthlyExpenseDTO";
import { MonetaryValue } from "~/shared/client/components/MonetaryValue";
import { Badge } from "~/shared/client/components/ui/badge";
import { Button } from "~/shared/client/components/ui/button";
import { Card, CardContent } from "~/shared/client/components/ui/card";
import { Checkbox } from "~/shared/client/components/ui/checkbox";
import { cn } from "~/shared/client/components/ui/lib";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/shared/client/components/ui/tooltip";
import type { Dictionary, Locale } from "~/shared/client/i18n";

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
    <Card
      className={cn(
        "gap-0 border-term-border border-l-2 bg-term-bg/45 shadow-none data-[size=sm]:py-0",
        "transition-colors hover:bg-term-chrome/65",
        expense.isPaid
          ? "border-l-term-green/70"
          : "border-l-term-amber/80 hover:border-l-term-green",
      )}
      size="sm"
    >
      <CardContent className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 py-2.5">
        <Checkbox
          aria-label={expense.isPaid ? t.markUnpaid : t.markPaid}
          checked={expense.isPaid}
          className="size-4 after:-inset-3"
          disabled={isSubmitting}
          onCheckedChange={(checked) => {
            if (checked !== expense.isPaid) onTogglePaid();
          }}
        />
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 items-start gap-2">
            <ReceiptText
              aria-hidden="true"
              className={cn(
                "mt-0.5 size-3.5 shrink-0",
                expense.isPaid ? "text-term-green/70" : "text-term-green",
              )}
            />
            <h2
              className={cn(
                "m-0 min-w-0 flex-1 break-words font-medium text-sm sm:truncate",
                expense.isPaid
                  ? "text-term-muted line-through decoration-term-green/45"
                  : "text-term-bright",
              )}
            >
              {expense.name}
            </h2>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-2xs text-term-muted">
            <span
              className={
                expense.expectedAmount ? "text-term-cyan" : "text-term-muted"
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
              <CalendarDays
                aria-hidden="true"
                className="size-3 text-term-amber"
              />
              {expense.dueDay
                ? `${t.dueDayPrefix} ${expense.dueDay}`
                : t.noDueDay}
            </span>
            <Badge
              className={cn(
                "shrink-0",
                expense.isPaid
                  ? "border-term-green/35 bg-term-green/5 text-term-green"
                  : "border-term-amber/35 bg-term-amber/5 text-term-amber",
              )}
              variant="outline"
            >
              {paidLabel}
            </Badge>
            {bankAccount && (
              <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                <Landmark
                  aria-hidden="true"
                  className="size-3 shrink-0 text-term-cyan"
                />
                <span className="truncate" title={bankAccount}>
                  {t.paymentRecorded} {bankAccount}
                </span>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {!bankAccount && Boolean(expense.expectedAmount) && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label={t.payFromAccount}
                    className="text-term-cyan hover:bg-term-cyan/10 hover:text-term-cyan"
                    disabled={isSubmitting}
                    onClick={onPayFromAccount}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  />
                }
              >
                <Landmark />
              </TooltipTrigger>
              <TooltipContent>{t.payFromAccount}</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label={t.editAction}
                  className="text-term-muted hover:text-term-cyan"
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
      </CardContent>
    </Card>
  );
}
