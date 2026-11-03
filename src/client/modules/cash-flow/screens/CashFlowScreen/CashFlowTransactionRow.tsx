import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Pencil,
  Trash2,
} from "lucide-react";
import { MonetaryValue } from "~/client/shared/components/MonetaryValue";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/client/shared/components/ui/alert-dialog";
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
    <article className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border border-border border-l-2 bg-background/45 px-3 py-3 transition-colors hover:border-l-brand hover:bg-muted/70">
      <span
        aria-hidden="true"
        className={
          isExpense
            ? "mt-0.5 rounded-md border border-destructive/20 bg-destructive/10 p-1.5 text-destructive"
            : "mt-0.5 rounded-md border border-success/20 bg-success/10 p-1.5 text-success"
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
            <Badge
              className="border-info/25 bg-info/10 text-info"
              variant="outline"
            >
              <ArrowRightLeft />
              {t.transferLabel}
            </Badge>
          )}
          {transaction.isLast && (
            <Badge
              className="border-info/25 bg-info/10 text-info"
              variant="outline"
            >
              {t.latestBadge}
            </Badge>
          )}
        </div>
        <p className="m-0 flex flex-wrap gap-x-2 gap-y-0.5 text-2xs text-muted-foreground">
          <span>{date}</span>
          <span aria-hidden="true">·</span>
          <span>{transaction.bankAccount}</span>
          <span aria-hidden="true">·</span>
          <span>{transaction.category}</span>
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <span
          className={
            isExpense
              ? "whitespace-nowrap font-semibold text-destructive text-sm tabular-nums"
              : "whitespace-nowrap font-semibold text-sm text-success tabular-nums"
          }
        >
          <MonetaryValue hiddenLabel={hiddenMonetaryValueLabel}>
            {currency.format(transaction.value)}
          </MonetaryValue>
        </span>
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
          <AlertDialog>
            <AlertDialogTrigger
              render={
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
                />
              }
            >
              <Trash2 className="text-destructive" />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogMedia className="bg-destructive/10 text-destructive">
                  <AlertTriangle />
                </AlertDialogMedia>
                <AlertDialogTitle>
                  {transaction.transferId
                    ? t.transferDeleteTitle
                    : t.deleteLastTitle}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {transaction.transferId
                    ? t.transferDeleteHint
                    : t.deleteLastConfirmation}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isSubmitting}>
                  {t.cancelAction}
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={isSubmitting}
                  onClick={onDelete}
                  variant="destructive"
                >
                  {t.deleteAction}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </article>
  );
}
