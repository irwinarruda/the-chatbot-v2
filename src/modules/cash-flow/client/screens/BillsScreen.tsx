import { Link, useNavigate } from "@tanstack/react-router";
import {
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ListChecks,
  MessageSquare,
  Plus,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import {
  type BillsSearch,
  getCurrentBillsMonth,
  shiftBillsMonth,
  toBillsRouteSearch,
} from "~/modules/cash-flow/client/BillsSearch";
import { MonthlyExpenseDialog } from "~/modules/cash-flow/client/components/MonthlyExpenseDialog";
import {
  MonthlyExpenseForm,
  type MonthlyExpenseFormValue,
} from "~/modules/cash-flow/client/components/MonthlyExpenseForm";
import { MonthlyExpenseRow } from "~/modules/cash-flow/client/components/MonthlyExpenseRow";
import type { MonthlyExpenseErrorCode } from "~/modules/cash-flow/client/state/monthlyExpenseSlice";
import type { MonthlyExpenseDTO } from "~/modules/cash-flow/entities/dtos/MonthlyExpenseDTO";
import { TerminalPageHeader } from "~/shared/client/components/terminal/TerminalPageHeader";
import { TerminalWindow } from "~/shared/client/components/terminal/TerminalWindow";
import { Alert, AlertDescription } from "~/shared/client/components/ui/alert";
import { Button } from "~/shared/client/components/ui/button";
import { Input } from "~/shared/client/components/ui/input";
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
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<MonthlyExpenseDTO>();
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

  async function onCreate(value: MonthlyExpenseFormValue) {
    const expense = await createExpense(value);
    if (!expense) return;
    setIsComposerOpen(false);
  }

  async function onUpdate(value: MonthlyExpenseFormValue) {
    if (!editingExpense) return;
    const expense = await updateExpense(editingExpense.id, {
      name: value.name,
      expectedAmount: value.expectedAmount ?? null,
      dueDay: value.dueDay ?? null,
    });
    if (!expense) return;
    setEditingExpense(undefined);
  }

  async function onDelete() {
    if (!editingExpense) return;
    const deleted = await archiveExpense(editingExpense.id);
    if (deleted) setEditingExpense(undefined);
  }

  function onMonthSelect(nextMonth: string) {
    if (!nextMonth) return;
    setIsComposerOpen(false);
    setEditingExpense(undefined);
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
      title={t.windowTitle}
      wide
      windowClassName="relative overflow-hidden p-4 sm:p-9 md:p-10"
    >
      <TerminalPageHeader
        badge={
          <div className="mt-3 flex flex-wrap justify-center gap-2 text-2xs sm:mt-4">
            <span className="hidden border border-term-cyan/40 px-2 py-1 text-term-cyan capitalize sm:inline-flex">
              {monthLabel}
            </span>
            <span className="border border-term-amber/40 px-2 py-1 text-term-amber">
              {unpaidCount} {t.remaining}
            </span>
            <Link
              className="inline-flex items-center gap-1 border border-term-blue/40 px-2 py-1 text-term-blue hover:border-term-cyan hover:text-term-cyan"
              to="/chat"
            >
              <MessageSquare className="size-3.5" />
              {t.chatAction}
            </Link>
          </div>
        }
        heading={t.heading}
        subtitle={t.subtitle}
        withLogo={false}
      />
      {errorMessage && (
        <Alert className="mb-4 border-term-red/30 bg-term-red/10">
          <AlertDescription className="flex items-center justify-between gap-3 text-term-red">
            <span>{errorMessage}</span>
            <Button onClick={clearError} size="icon-xs" variant="ghost">
              x
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <section
        aria-label={t.monthNavigationLabel}
        className="mb-4 border border-term-border bg-term-chrome/50 p-3"
      >
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-2 sm:grid-cols-[auto_minmax(0,12rem)_auto_auto]">
          <Button
            aria-label={t.previousMonth}
            onClick={() => onMonthSelect(shiftBillsMonth(selectedMonth, -1))}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronLeft />
          </Button>
          <label className="space-y-1.5" htmlFor="bills-month">
            <span className="flex items-center gap-1.5 text-2xs text-term-muted uppercase tracking-wide">
              <CalendarRange className="size-3.5 text-term-cyan" />
              {t.monthLabel}
            </span>
            <Input
              id="bills-month"
              max={currentMonth}
              onChange={(event) => onMonthSelect(event.target.value)}
              type="month"
              value={selectedMonth}
            />
          </label>
          <Button
            aria-label={t.nextMonth}
            disabled={selectedMonth >= currentMonth}
            onClick={() => onMonthSelect(shiftBillsMonth(selectedMonth, 1))}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronRight />
          </Button>
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
        </div>
        <p className="mt-2 mb-0 hidden text-2xs text-term-muted sm:block">
          {t.monthHistoryHint}
        </p>
        {search.month !== undefined && (
          <Button
            className="mt-2 w-full sm:hidden"
            onClick={() => onMonthSelect(currentMonth)}
            size="sm"
            type="button"
            variant="outline"
          >
            {t.currentMonthAction}
          </Button>
        )}
      </section>
      <section className="mb-4 overflow-hidden border border-term-border bg-term-bg/55">
        <div className="flex items-center justify-between gap-3 border-term-border border-b bg-term-chrome/60 p-3">
          <div>
            <div className="flex items-center gap-2 text-term-green text-xs uppercase tracking-wider">
              <ListChecks className="size-3.5" />
              {t.progressLabel}
            </div>
            <p className="mt-1 mb-0 text-2xs text-term-muted">
              {paidCount} {t.of} {monthlyExpenses.length} {t.paidThisMonth}
            </p>
          </div>
          <span className="font-semibold text-2xl text-term-green tabular-nums">
            {progress}%
          </span>
        </div>
        <div className="h-1.5 bg-term-border/60">
          <div
            aria-label={t.progressLabel}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progress}
            className="h-full bg-term-green transition-[width] duration-500 motion-reduce:transition-none"
            role="progressbar"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-term-border sm:grid-cols-4 sm:divide-y-0">
          <SummaryItem
            icon={<CheckCircle2 className="size-3.5 text-term-green" />}
            label={t.paid}
            value={paidCount.toString()}
          />
          <SummaryItem
            icon={<ReceiptText className="size-3.5 text-term-amber" />}
            label={t.unpaid}
            value={unpaidCount.toString()}
          />
          <SummaryItem
            icon={<WalletCards className="size-3.5 text-term-cyan" />}
            label={t.expectedTotal}
            value={currency.format(expectedTotal)}
          />
          <SummaryItem
            icon={<CircleDollarSign className="size-3.5 text-term-green" />}
            label={t.paidAmount}
            value={currency.format(paidTotal)}
          />
        </div>
      </section>
      <section className="mb-4">
        {isComposerOpen ? (
          <div className="border border-term-green/25 bg-term-green/5 p-3 sm:p-4">
            <div className="mb-4 flex items-center gap-2 text-2xs text-term-green uppercase tracking-wider">
              <span>&gt;</span>
              {t.createPrompt}
            </div>
            <MonthlyExpenseForm
              isSubmitting={isSubmitting}
              onCancel={() => setIsComposerOpen(false)}
              onSubmit={onCreate}
              t={t}
            />
          </div>
        ) : (
          <Button
            className="w-full sm:w-auto"
            onClick={() => setIsComposerOpen(true)}
            type="button"
          >
            <Plus />
            {t.createPrompt}
          </Button>
        )}
      </section>
      <section className="space-y-2">
        <div className="flex items-center gap-2 text-2xs text-term-muted uppercase">
          <ReceiptText className="size-3.5 text-term-green" />
          {t.listLabel}
        </div>
        {isBootstrapping ? (
          <div className="border border-term-border bg-term-bg/40 p-8 text-center text-sm text-term-muted">
            <span className="terminal-cursor" />
            {t.loading}
          </div>
        ) : monthlyExpenses.length > 0 ? (
          monthlyExpenses.map((expense) => (
            <MonthlyExpenseRow
              expense={expense}
              isSubmitting={isSubmitting}
              key={expense.id}
              locale={prefs.locale}
              onEdit={() => setEditingExpense(expense)}
              onTogglePaid={() => setPaid(expense.id, !expense.isPaid)}
              t={t}
            />
          ))
        ) : (
          <div className="border border-term-border border-dashed bg-term-bg/40 p-8 text-center">
            <ReceiptText className="mx-auto mb-3 size-8 text-term-green/60" />
            <p className="m-0 text-sm text-term-bright">{t.emptyState}</p>
            <p className="mt-1 mb-0 text-term-muted text-xs">{t.emptyHint}</p>
          </div>
        )}
      </section>
      <MonthlyExpenseDialog
        canArchive={selectedMonth === currentMonth}
        expense={editingExpense}
        isSubmitting={isSubmitting}
        onClose={() => setEditingExpense(undefined)}
        onDelete={onDelete}
        onSave={onUpdate}
        t={t}
      />
    </TerminalWindow>
  );
}

function SummaryItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 p-2.5 sm:p-3">
      <div className="mb-1 flex items-center gap-1.5 text-2xs text-term-muted uppercase">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="truncate font-medium text-sm text-term-bright tabular-nums">
        {value}
      </div>
    </div>
  );
}
