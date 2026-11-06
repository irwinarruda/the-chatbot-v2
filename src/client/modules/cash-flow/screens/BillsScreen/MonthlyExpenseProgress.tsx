import type { ReactNode } from "react";
import { MonetaryValue } from "~/client/shared/components/MonetaryValue";
import { Progress } from "~/client/shared/components/ui/progress";
import type { Dictionary, Locale } from "~/client/shared/i18n/dictionary";
import type { MonthlyExpenseDTO } from "~/contracts/http/cash-flow/monthly-expense";

export function MonthlyExpenseProgress({
  expenses,
  hiddenMonetaryValueLabel,
  locale,
  t,
}: {
  expenses: MonthlyExpenseDTO[];
  hiddenMonetaryValueLabel: string;
  locale: Locale;
  t: Dictionary["billsPage"];
}) {
  const paidCount = expenses.filter((expense) => expense.isPaid).length;
  const unpaidCount = expenses.length - paidCount;
  const expectedTotal = expenses.reduce(
    (total, expense) => total + (expense.expectedAmount ?? 0),
    0,
  );
  const paidTotal = expenses.reduce((total, expense) => {
    if (!expense.isPaid) return total;
    return total + (expense.expectedAmount ?? 0);
  }, 0);
  const leftTotal = Math.max(expectedTotal - paidTotal, 0);
  let currencyLocale = "en-US";
  if (locale === "pt-BR") currencyLocale = "pt-BR";
  const currency = new Intl.NumberFormat(currencyLocale, {
    style: "currency",
    currency: "BRL",
  });
  let progress = 0;
  if (expectedTotal > 0)
    progress = Math.round((paidTotal / expectedTotal) * 100);
  const summary = t.paidSummary
    .replace("{paid}", paidCount.toString())
    .replace("{total}", expenses.length.toString())
    .replace("{percent}", progress.toString());

  return (
    <section
      aria-label={t.progressLabel}
      className="mb-6 overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="px-5 pt-4 pb-4">
        <p className="m-0 font-medium text-muted-foreground text-sm">
          {t.leftToPay}
        </p>
        <p className="m-0 mt-1 font-semibold text-3xl text-foreground tabular-nums tracking-tight">
          <MonetaryValue hiddenLabel={hiddenMonetaryValueLabel}>
            {currency.format(leftTotal)}
          </MonetaryValue>
        </p>
        <p className="m-0 mt-1 text-muted-foreground text-sm">{summary}</p>
        <Progress
          aria-label={`${t.progressLabel}: ${progress}%`}
          className="mt-4 gap-0 px-0 [&_[data-slot=progress-indicator]]:bg-primary [&_[data-slot=progress-indicator]]:motion-reduce:transition-none [&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:rounded-full [&_[data-slot=progress-track]]:bg-muted"
          value={progress}
        />
      </div>
      <dl className="m-0 grid grid-cols-2 border-border border-t sm:grid-cols-4">
        <SummaryMetric label={t.paid} value={paidCount.toString()} />
        <SummaryMetric label={t.unpaid} value={unpaidCount.toString()} />
        <SummaryMetric
          label={t.expectedTotal}
          value={
            <MonetaryValue hiddenLabel={hiddenMonetaryValueLabel}>
              {currency.format(expectedTotal)}
            </MonetaryValue>
          }
        />
        <SummaryMetric
          label={t.paidAmount}
          value={
            <MonetaryValue hiddenLabel={hiddenMonetaryValueLabel}>
              {currency.format(paidTotal)}
            </MonetaryValue>
          }
        />
      </dl>
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 border-border px-5 py-3 even:border-l sm:border-l sm:first:border-l-0 [&:nth-child(n+3)]:border-t sm:[&:nth-child(n+3)]:border-t-0">
      <dt className="truncate text-muted-foreground text-xs">{label}</dt>
      <dd className="m-0 mt-0.5 truncate font-medium text-foreground text-sm tabular-nums">
        {value}
      </dd>
    </div>
  );
}
