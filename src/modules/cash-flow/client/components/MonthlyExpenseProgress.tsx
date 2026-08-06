import {
  CheckCircle2,
  CircleDollarSign,
  ListChecks,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import type { MonthlyExpenseDTO } from "~/modules/cash-flow/entities/dtos/MonthlyExpenseDTO";
import { Button } from "~/shared/client/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/shared/client/components/ui/card";
import { Progress } from "~/shared/client/components/ui/progress";
import type { Dictionary, Locale } from "~/shared/client/i18n";

const ProgressMeasure = {
  Count: "count",
  Value: "value",
} as const;

type ProgressMeasure = ValueOf<typeof ProgressMeasure>;

export function MonthlyExpenseProgress({
  expenses,
  locale,
  t,
}: {
  expenses: MonthlyExpenseDTO[];
  locale: Locale;
  t: Dictionary["billsPage"];
}) {
  const [measure, setMeasure] = useState<ProgressMeasure>(
    ProgressMeasure.Count,
  );
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
  let currencyLocale = "en-US";
  if (locale === "pt-BR") currencyLocale = "pt-BR";
  const currency = new Intl.NumberFormat(currencyLocale, {
    style: "currency",
    currency: "BRL",
  });
  let progress = 0;
  let progressDescription = `${paidCount} ${t.of} ${expenses.length} ${t.paidThisMonth}`;
  let progressMeasure = t.progressByCount;
  if (measure === ProgressMeasure.Count && expenses.length > 0) {
    progress = Math.round((paidCount / expenses.length) * 100);
  }
  if (measure === ProgressMeasure.Value) {
    progressMeasure = t.progressByValue;
    progressDescription = `${currency.format(paidTotal)} ${t.of} ${currency.format(expectedTotal)} ${t.paidValueThisMonth}`;
    if (expectedTotal > 0) {
      progress = Math.round((paidTotal / expectedTotal) * 100);
    }
  }

  function onCountSelect() {
    setMeasure(ProgressMeasure.Count);
  }

  function onValueSelect() {
    setMeasure(ProgressMeasure.Value);
  }

  return (
    <Card
      className="mb-4 gap-0 border-term-border bg-term-chrome/45 py-0 shadow-none"
      size="sm"
    >
      <CardHeader className="border-term-border border-b px-3 py-3">
        <CardTitle className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-term-green text-xs uppercase tracking-wider">
          <span className="flex items-center gap-2">
            <ListChecks aria-hidden="true" className="size-3.5" />
            {t.progressLabel}
          </span>
          <fieldset
            aria-label={t.progressMeasureLabel}
            className="flex rounded-md border border-term-border bg-term-bg/35 p-0.5 normal-case tracking-normal"
          >
            <Button
              aria-pressed={measure === ProgressMeasure.Count}
              className="pointer-fine:h-5 aria-pressed:bg-term-green/10 aria-pressed:text-term-green"
              onClick={onCountSelect}
              size="xs"
              type="button"
              variant="ghost"
            >
              {t.progressByCount}
            </Button>
            <Button
              aria-pressed={measure === ProgressMeasure.Value}
              className="pointer-fine:h-5 aria-pressed:bg-term-green/10 aria-pressed:text-term-green"
              onClick={onValueSelect}
              size="xs"
              type="button"
              variant="ghost"
            >
              {t.progressByValue}
            </Button>
          </fieldset>
        </CardTitle>
        <CardDescription className="font-mono text-2xs text-term-muted">
          {progressDescription}
        </CardDescription>
        <CardAction>
          <span className="font-mono font-semibold text-2xl text-term-green tabular-nums">
            {progress}%
          </span>
        </CardAction>
      </CardHeader>
      <Progress
        aria-label={`${t.progressLabel}: ${progressMeasure}`}
        className="gap-0 px-0 [&_[data-slot=progress-indicator]]:bg-term-green [&_[data-slot=progress-indicator]]:motion-reduce:transition-none [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:rounded-none [&_[data-slot=progress-track]]:bg-term-border/60"
        value={progress}
      />
      <dl className="grid grid-cols-2 sm:grid-cols-4">
        <SummaryMetric
          icon={<CheckCircle2 className="size-3.5 text-term-green" />}
          label={t.paid}
          value={paidCount.toString()}
        />
        <SummaryMetric
          icon={<ReceiptText className="size-3.5 text-term-amber" />}
          label={t.unpaid}
          value={unpaidCount.toString()}
        />
        <SummaryMetric
          icon={<WalletCards className="size-3.5 text-term-cyan" />}
          label={t.expectedTotal}
          value={currency.format(expectedTotal)}
        />
        <SummaryMetric
          icon={<CircleDollarSign className="size-3.5 text-term-green" />}
          label={t.paidAmount}
          value={currency.format(paidTotal)}
        />
      </dl>
    </Card>
  );
}

function SummaryMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 border-term-border/70 border-t p-3 even:border-l sm:border-l sm:first:border-l-0">
      <dt className="mb-1 flex items-center gap-1.5 font-mono text-2xs text-term-muted">
        <span aria-hidden="true">{icon}</span>
        <span className="truncate">{label}</span>
      </dt>
      <dd className="m-0 truncate font-medium font-mono text-sm text-term-bright tabular-nums">
        {value}
      </dd>
    </div>
  );
}
