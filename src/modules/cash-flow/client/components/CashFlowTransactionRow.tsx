import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Trash2,
} from "lucide-react";
import type { CashFlowTransactionResponseDTO } from "~/modules/cash-flow/entities/dtos/CashFlowWebDTO";
import { CashFlowTransactionType } from "~/modules/cash-flow/entities/enums/CashFlowTransactionType";
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
} from "~/shared/client/components/ui/alert-dialog";
import { Badge } from "~/shared/client/components/ui/badge";
import { Button } from "~/shared/client/components/ui/button";
import type { Dictionary, Locale } from "~/shared/client/i18n";

export function CashFlowTransactionRow({
  currency,
  isSubmitting,
  locale,
  onDelete,
  t,
  transaction,
}: {
  currency: Intl.NumberFormat;
  isSubmitting: boolean;
  locale: Locale;
  onDelete: () => void;
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
    <article className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border border-term-border border-l-2 bg-term-bg/45 px-3 py-3 transition-colors hover:border-l-term-green hover:bg-term-chrome/70">
      <span
        aria-hidden="true"
        className={
          isExpense
            ? "mt-0.5 rounded-md border border-term-red/20 bg-term-red/8 p-1.5 text-term-red"
            : "mt-0.5 rounded-md border border-term-green/20 bg-term-green/8 p-1.5 text-term-green"
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
          <h3 className="min-w-0 truncate font-medium text-sm text-term-bright">
            {transaction.description}
          </h3>
          {transaction.isLast && (
            <Badge
              className="border-term-cyan/25 bg-term-cyan/8 text-term-cyan"
              variant="outline"
            >
              {t.latestBadge}
            </Badge>
          )}
        </div>
        <p className="m-0 flex flex-wrap gap-x-2 gap-y-0.5 text-2xs text-term-muted">
          <span>{date}</span>
          <span aria-hidden="true">·</span>
          <span>{transaction.bankAccount}</span>
          <span aria-hidden="true">·</span>
          <span>{transaction.category}</span>
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className={
            isExpense
              ? "whitespace-nowrap font-semibold text-sm text-term-red tabular-nums"
              : "whitespace-nowrap font-semibold text-sm text-term-green tabular-nums"
          }
        >
          {currency.format(transaction.value)}
        </span>
        {transaction.isLast && (
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  aria-label={t.deleteLastAction}
                  disabled={isSubmitting}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                />
              }
            >
              <Trash2 className="text-term-red" />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogMedia className="bg-term-red/10 text-term-red">
                  <AlertTriangle />
                </AlertDialogMedia>
                <AlertDialogTitle>{t.deleteLastTitle}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t.deleteLastConfirmation}
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
