import {
  CalendarDays,
  Landmark,
  Pencil,
  ReceiptText,
  Tags,
} from "lucide-react";
import { MonetaryValue } from "~/client/shared/components/MonetaryValue";
import { Badge } from "~/client/shared/components/ui/badge";
import { Button } from "~/client/shared/components/ui/button";
import { Card, CardContent } from "~/client/shared/components/ui/card";
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
    <Card
      className={cn(
        "gap-0 border-border border-l-2 bg-background/45 shadow-none data-[size=sm]:py-0",
        "transition-colors hover:bg-muted/65",
        expense.isPaid
          ? "border-l-success/70"
          : "border-l-warning/80 hover:border-l-brand",
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
                expense.isPaid ? "text-muted-foreground" : "text-primary",
              )}
            />
            <h2
              className={cn(
                "m-0 min-w-0 flex-1 break-words font-medium text-sm sm:truncate",
                expense.isPaid
                  ? "text-muted-foreground line-through decoration-success/45"
                  : "text-foreground",
              )}
            >
              {expense.name}
            </h2>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-2xs text-muted-foreground">
            <span
              className={
                expense.expectedAmount
                  ? "text-syntax-constant"
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
            {expense.category && (
              <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                <Tags aria-hidden="true" className="size-3 shrink-0" />
                <span className="sr-only">{t.categoryLabel}:</span>
                <span className="truncate" title={expense.category}>
                  {expense.category}
                </span>
              </span>
            )}
            <Badge
              className={cn(
                "shrink-0",
                expense.isPaid
                  ? "border-success/35 bg-success/10 text-success"
                  : "border-warning/35 bg-warning/10 text-warning",
              )}
              variant="outline"
            >
              {paidLabel}
            </Badge>
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
          {!bankAccount && Boolean(expense.expectedAmount) && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label={t.payFromAccount}
                    className="text-primary hover:bg-brand/12 hover:text-primary"
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
      </CardContent>
    </Card>
  );
}
