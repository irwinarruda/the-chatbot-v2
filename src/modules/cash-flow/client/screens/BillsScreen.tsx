import { Link, useNavigate } from "@tanstack/react-router";
import {
  CalendarRange,
  CheckCircle2,
  CircleAlert,
  CircleDollarSign,
  ListChecks,
  MessageSquare,
  Plus,
  ReceiptText,
  WalletCards,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import {
  type BillsSearch,
  getCurrentBillsMonth,
  toBillsRouteSearch,
} from "~/modules/cash-flow/client/BillsSearch";
import { BillsMonthSelect } from "~/modules/cash-flow/client/components/BillsMonthSelect";
import { MonthlyExpenseDialog } from "~/modules/cash-flow/client/components/MonthlyExpenseDialog";
import type { MonthlyExpenseFormValue } from "~/modules/cash-flow/client/components/MonthlyExpenseForm";
import { MonthlyExpenseRow } from "~/modules/cash-flow/client/components/MonthlyExpenseRow";
import type { MonthlyExpenseErrorCode } from "~/modules/cash-flow/client/state/monthlyExpenseSlice";
import type { MonthlyExpenseDTO } from "~/modules/cash-flow/entities/dtos/MonthlyExpenseDTO";
import { TerminalPageHeader } from "~/shared/client/components/terminal/TerminalPageHeader";
import { TerminalWindow } from "~/shared/client/components/terminal/TerminalWindow";
import {
  Alert,
  AlertAction,
  AlertDescription,
} from "~/shared/client/components/ui/alert";
import { Badge } from "~/shared/client/components/ui/badge";
import { Button } from "~/shared/client/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/shared/client/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/shared/client/components/ui/empty";
import { Field, FieldLabel } from "~/shared/client/components/ui/field";
import { Progress } from "~/shared/client/components/ui/progress";
import { Skeleton } from "~/shared/client/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/shared/client/components/ui/tooltip";
import { getDictionary } from "~/shared/client/i18n";
import { usePrefs } from "~/shared/client/providers/usePrefs";
import { useApp } from "~/shared/client/stores";

export function BillsScreen({ search }: { search: BillsSearch }) {
  const navigate = useNavigate();
  const prefs = usePrefs();
  const monthlyExpenses = useApp((state) => state.monthlyExpenses);
  const month = useApp((state) => state.monthlyExpenseMonth);
  const isBootstrapping = useApp(
    (state) => state.isMonthlyExpenseBootstrapping,
  );
  const isSubmitting = useApp((state) => state.isMonthlyExpenseSubmitting);
  const error = useApp((state) => state.monthlyExpenseError);
  const bootstrap = useApp((state) => state.bootstrapMonthlyExpenses);
  const createExpense = useApp((state) => state.createMonthlyExpense);
  const updateExpense = useApp((state) => state.updateMonthlyExpense);
  const archiveExpense = useApp((state) => state.archiveMonthlyExpense);
  const setPaid = useApp((state) => state.setMonthlyExpensePaid);
  const clearError = useApp((state) => state.clearMonthlyExpenseError);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<MonthlyExpenseDTO>();
  const isDialogOpen = isCreateOpen || editingExpense !== undefined;
  const dictionary = getDictionary(prefs.locale);
  const t = dictionary.billsPage;
  const currentMonth = getCurrentBillsMonth();
  const selectedMonth = search.month ?? currentMonth;
  const paidCount = monthlyExpenses.filter((expense) => expense.isPaid).length;
  const unpaidCount = monthlyExpenses.length - paidCount;
  const progress =
    monthlyExpenses.length === 0
      ? 0
      : Math.round((paidCount / monthlyExpenses.length) * 100);
  const expectedTotal = monthlyExpenses.reduce(
    (total, expense) => total + (expense.expectedAmount ?? 0),
    0,
  );
  const paidTotal = monthlyExpenses.reduce(
    (total, expense) =>
      total + (expense.isPaid ? (expense.expectedAmount ?? 0) : 0),
    0,
  );
  const currency = new Intl.NumberFormat(
    prefs.locale === "pt-BR" ? "pt-BR" : "en-US",
    { style: "currency", currency: "BRL" },
  );
  const monthLabel = new Intl.DateTimeFormat(
    prefs.locale === "pt-BR" ? "pt-BR" : "en-US",
    {
      month: "long",
      year: "numeric",
      timeZone: "America/Sao_Paulo",
    },
  ).format(new Date(`${selectedMonth}-15T12:00:00.000Z`));
  const errorMessages: Record<MonthlyExpenseErrorCode, string> = {
    loading: t.errorLoading,
    saving: t.errorSaving,
    deleting: t.errorDeleting,
  };
  const errorMessage = error ? errorMessages[error] : undefined;

  function onCloseDialog() {
    setIsCreateOpen(false);
    setEditingExpense(undefined);
  }

  function onOpenCreate() {
    setEditingExpense(undefined);
    setIsCreateOpen(true);
  }

  function onOpenEdit(expense: MonthlyExpenseDTO) {
    setIsCreateOpen(false);
    setEditingExpense(expense);
  }

  async function onSaveDialog(value: MonthlyExpenseFormValue) {
    if (editingExpense) {
      const expense = await updateExpense(editingExpense.id, {
        name: value.name,
        expectedAmount: value.expectedAmount ?? null,
        dueDay: value.dueDay ?? null,
      });
      if (!expense) return;
      onCloseDialog();
      return;
    }
    const expense = await createExpense(value);
    if (!expense) return;
    onCloseDialog();
  }

  async function onDelete() {
    if (!editingExpense) return;
    const deleted = await archiveExpense(editingExpense.id);
    if (deleted) onCloseDialog();
  }

  function onMonthSelect(nextMonth: string) {
    if (!nextMonth) return;
    onCloseDialog();
    navigate({
      to: "/bills",
      search: toBillsRouteSearch(nextMonth),
    });
  }

  useEffect(() => {
    void bootstrap(selectedMonth);
  }, [bootstrap, selectedMonth]);

  useEffect(() => {
    if (search.month) return;
    function refreshAfterMonthChange() {
      const nextCurrentMonth = getCurrentBillsMonth();
      if (month && nextCurrentMonth !== month) void bootstrap(nextCurrentMonth);
    }
    const interval = window.setInterval(refreshAfterMonthChange, 60_000);
    document.addEventListener("visibilitychange", refreshAfterMonthChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshAfterMonthChange);
    };
  }, [bootstrap, month, search.month]);

  return (
    <TerminalWindow
      activePath="/bills"
      dictionary={dictionary}
      frameClassName="page-frame-min-height"
      mainClassName="items-stretch sm:items-start"
      showLogout
      title={t.windowTitle}
      wide
      windowClassName="relative overflow-hidden"
    >
      <TerminalPageHeader
        badge={
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Badge
              className="hidden gap-1.5 border-term-cyan/40 bg-term-cyan/5 text-term-cyan capitalize sm:inline-flex"
              variant="outline"
            >
              {monthLabel}
            </Badge>
            <Badge
              className="gap-1.5 border-term-amber/40 bg-term-amber/5 text-term-amber"
              variant="outline"
            >
              {unpaidCount} {t.remaining}
            </Badge>
            <Badge
              className="gap-1.5 border-term-blue/40 bg-term-blue/5 text-term-blue hover:border-term-cyan hover:bg-term-cyan/10 hover:text-term-cyan"
              render={<Link to="/chat" />}
              variant="outline"
            >
              <MessageSquare />
              {t.chatAction}
            </Badge>
          </div>
        }
        heading={t.heading}
        subtitle={t.subtitle}
        withLogo={false}
      />
      {errorMessage ? (
        <Alert
          className="mb-4 border-term-red/30 bg-term-red/10"
          variant="destructive"
        >
          <CircleAlert />
          <AlertDescription>{errorMessage}</AlertDescription>
          <AlertAction>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label={dictionary.common.dismiss}
                    onClick={clearError}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  />
                }
              >
                <X />
              </TooltipTrigger>
              <TooltipContent>{dictionary.common.dismiss}</TooltipContent>
            </Tooltip>
          </AlertAction>
        </Alert>
      ) : null}
      <Card
        aria-label={t.monthNavigationLabel}
        className="mb-4 gap-0 border-term-border bg-term-chrome/45 py-0 shadow-none"
        size="sm"
      >
        <CardContent className="space-y-3 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field className="w-full min-w-0 flex-1 gap-1.5 sm:w-auto sm:max-w-sm">
              <FieldLabel
                className="flex items-center gap-1.5 font-mono text-2xs text-term-muted uppercase tracking-wide"
                htmlFor="bills-month"
              >
                <CalendarRange
                  aria-hidden="true"
                  className="size-3.5 text-term-cyan"
                />
                {t.monthLabel}
              </FieldLabel>
              <BillsMonthSelect
                describedBy="bills-month-description"
                id="bills-month"
                locale={prefs.locale}
                maxMonth={currentMonth}
                nextMonthLabel={t.nextMonth}
                onMonthChange={onMonthSelect}
                previousMonthLabel={t.previousMonth}
                value={selectedMonth}
              />
            </Field>
            <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:items-center">
              {search.month !== undefined && (
                <Button
                  className="hidden sm:inline-flex"
                  onClick={() => onMonthSelect(currentMonth)}
                  type="button"
                  variant="outline"
                >
                  {t.currentMonthAction}
                </Button>
              )}
              <Button
                className="w-full sm:w-auto"
                onClick={onOpenCreate}
                type="button"
              >
                <Plus />
                {t.createPrompt}
              </Button>
            </div>
          </div>
          <p
            className="mb-0 font-mono text-2xs text-term-muted"
            id="bills-month-description"
          >
            {t.monthHistoryHint}
          </p>
          {search.month !== undefined && (
            <Button
              className="w-full sm:hidden"
              onClick={() => onMonthSelect(currentMonth)}
              size="sm"
              type="button"
              variant="outline"
            >
              {t.currentMonthAction}
            </Button>
          )}
        </CardContent>
      </Card>
      <Card
        className="mb-4 gap-0 border-term-border bg-term-chrome/45 py-0 shadow-none"
        size="sm"
      >
        <CardHeader className="border-term-border border-b px-3 py-3">
          <CardTitle className="flex items-center gap-2 font-mono text-term-green text-xs uppercase tracking-wider">
            <ListChecks aria-hidden="true" className="size-3.5" />
            {t.progressLabel}
          </CardTitle>
          <CardDescription className="font-mono text-2xs text-term-muted">
            {paidCount} {t.of} {monthlyExpenses.length} {t.paidThisMonth}
          </CardDescription>
          <CardAction>
            <span className="font-mono font-semibold text-2xl text-term-green tabular-nums">
              {progress}%
            </span>
          </CardAction>
        </CardHeader>
        <Progress
          aria-label={t.progressLabel}
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
      <section aria-labelledby="monthly-bills-list" className="space-y-2">
        <div
          className="flex items-center gap-2 font-mono text-2xs text-term-muted uppercase tracking-wide"
          id="monthly-bills-list"
        >
          <ReceiptText
            aria-hidden="true"
            className="size-3.5 text-term-green"
          />
          {t.listLabel}
        </div>
        {isBootstrapping ? (
          <MonthlyExpenseListSkeleton label={t.loading} />
        ) : monthlyExpenses.length > 0 ? (
          <ul className="m-0 list-none space-y-2 p-0">
            {monthlyExpenses.map((expense) => (
              <li key={expense.id}>
                <MonthlyExpenseRow
                  expense={expense}
                  isSubmitting={isSubmitting}
                  locale={prefs.locale}
                  onEdit={() => onOpenEdit(expense)}
                  onTogglePaid={() => setPaid(expense.id, !expense.isPaid)}
                  t={t}
                />
              </li>
            ))}
          </ul>
        ) : (
          <Empty className="rounded-lg border border-term-border bg-term-bg/40 py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ReceiptText className="text-term-green" />
              </EmptyMedia>
              <EmptyTitle className="text-term-muted">
                {t.emptyState}
              </EmptyTitle>
              <EmptyDescription className="text-term-muted">
                {t.emptyHint}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>
      <MonthlyExpenseDialog
        canArchive={selectedMonth === currentMonth}
        expense={editingExpense}
        isSubmitting={isSubmitting}
        onClose={onCloseDialog}
        onDelete={onDelete}
        onSave={onSaveDialog}
        open={isDialogOpen}
        t={t}
      />
    </TerminalWindow>
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

function MonthlyExpenseListSkeleton({ label }: { label: string }) {
  return (
    <div aria-label={label} className="space-y-2" role="status">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((item) => (
        <Card
          aria-hidden="true"
          className="gap-0 border-term-border border-l-2 bg-term-bg/45 py-0 shadow-none"
          key={item}
          size="sm"
        >
          <CardContent className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2.5 px-2.5 py-2">
            <Skeleton className="size-4 rounded-sm" />
            <div className="space-y-1">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-5 w-14" />
            <Skeleton className="size-7" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
