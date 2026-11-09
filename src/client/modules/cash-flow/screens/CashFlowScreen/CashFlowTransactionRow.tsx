import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Pencil,
  Trash2,
} from "lucide-react";
import { ConfirmDialog } from "~/client/shared/components/ConfirmDialog";
import { MonetaryValue } from "~/client/shared/components/MonetaryValue";
import { Badge } from "~/client/shared/components/ui/badge";
import { Button } from "~/client/shared/components/ui/button";
import type { Dictionary, Locale } from "~/client/shared/i18n/dictionary";
import type { CashFlowTransactionResponseDTO } from "~/contracts/http/cash-flow/cash-flow";
import { CashFlowTransactionType } from "~/domain/cash-flow/cash-flow-transaction-type";

export function CashFlowTransactionRow({
  currency,
  hiddenMonetaryValueLabel,
  isSubmitting,
  locale,
  onDelete,
  onEditTransfer,
  t,
  transaction,
}: {
  currency: Intl.NumberFormat;
  hiddenMonetaryValueLabel: string;
  isSubmitting: boolean;
  locale: Locale;
  onDelete: () => void;
  onEditTransfer?: () => void;
  t: Dictionary["cashFlowPage"];
  transaction: CashFlowTransactionResponseDTO;
}) {
  const isExpense = transaction.type === CashFlowTransactionType.Expense;
  const date = new Intl.DateTimeFormat(locale === "pt-BR" ? "pt-BR" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(transaction.date));

  return (
    <article className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60">
      <span
        aria-hidden="true"
        className={
          isExpense
            ? "rounded-full bg-muted p-2 text-muted-foreground"
            : "rounded-full bg-success-soft p-2 text-success"
        }
      >
        {isExpense ? (
          <ArrowDownLeft className="size-3.5" />
        ) : (
          <ArrowUpRight className="size-3.5" />
        )}
      </span>
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <h3 className="min-w-0 truncate font-medium text-foreground text-sm">
            {transaction.description ||
              (transaction.transferId ? t.transferLabel : "")}
          </h3>
          {transaction.transferId && (
            <Badge variant="info">
              <ArrowRightLeft />
              {t.transferLabel}
            </Badge>
          )}
          {transaction.isLast && (
            <Badge
              className="border-border bg-muted text-muted-foreground"
              title={t.latestHint}
              variant="outline"
            >
              {t.latestBadge}
            </Badge>
          )}
        </div>
        <p className="m-0 flex min-w-0 gap-x-1.5 truncate text-muted-foreground text-xs">
          <span>{date}</span>
          <span aria-hidden="true">·</span>
          <span>{transaction.bankAccount}</span>
          <span aria-hidden="true">·</span>
          <span>{transaction.category}</span>
        </p>
      </div>
      <div className="flex items-center justify-end gap-1.5">
        <span
          className={
            isExpense
              ? "whitespace-nowrap font-medium text-foreground text-sm tabular-nums"
              : "whitespace-nowrap font-medium text-sm text-success tabular-nums"
          }
        >
          <MonetaryValue hiddenLabel={hiddenMonetaryValueLabel}>
            {currency.format(transaction.value)}
          </MonetaryValue>
        </span>
        <div className="flex shrink-0 justify-end gap-1 empty:hidden sm:min-w-8 sm:empty:flex">
          {transaction.transferId && (
            <Button
              aria-label={t.transferEditAction}
              disabled={isSubmitting}
              onClick={onEditTransfer}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <Pencil />
            </Button>
          )}
          {(Boolean(transaction.transferId) ||
            (transaction.isLast && !transaction.paymentId)) && (
            <ConfirmDialog
              cancelLabel={t.cancelAction}
              confirmLabel={t.deleteAction}
              description={
                transaction.transferId
                  ? t.transferDeleteHint
                  : t.deleteLastConfirmation
              }
              isDisabled={isSubmitting}
              onConfirm={onDelete}
              title={
                transaction.transferId
                  ? t.transferDeleteTitle
                  : t.deleteLastTitle
              }
              trigger={
                <Button
                  aria-label={
                    transaction.transferId
                      ? t.transferDeleteAction
                      : t.deleteLastAction
                  }
                  disabled={isSubmitting}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="text-destructive" />
                </Button>
              }
            >
              <p className="m-0 rounded-lg border border-border bg-muted/50 px-3 py-2 text-left text-foreground text-sm">
                <span className="font-medium">
                  {transaction.description ||
                    (transaction.transferId ? t.transferLabel : "")}
                </span>
                <span className="block text-muted-foreground text-xs tabular-nums">
                  <MonetaryValue hiddenLabel={hiddenMonetaryValueLabel}>
                    {currency.format(transaction.value)}
                  </MonetaryValue>{" "}
                  · {date} · {transaction.bankAccount}
                </span>
              </p>
            </ConfirmDialog>
          )}
        </div>
      </div>
    </article>
  );
}
