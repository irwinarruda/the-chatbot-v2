import { useNavigate } from "@tanstack/react-router";
import { CircleAlert, Plus, ReceiptText, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { MonthlyExpenseErrorCode } from "~/client/modules/cash-flow/app/services/MonthlyExpenseService";
import {
  type BillsSearch,
  getCurrentBillsMonth,
  toBillsRouteSearch,
} from "~/client/modules/cash-flow/parsers/BillsSearch";
import { ListEmptyState } from "~/client/shared/components/ListEmptyState";
import { AppShell } from "~/client/shared/components/terminal/AppShell";
import { TerminalPageHeader } from "~/client/shared/components/terminal/TerminalPageHeader";
import {
  Alert,
  AlertAction,
  AlertDescription,
} from "~/client/shared/components/ui/alert";
import { Button } from "~/client/shared/components/ui/button";
import { Card, CardContent } from "~/client/shared/components/ui/card";
import { Field, FieldLabel } from "~/client/shared/components/ui/field";
import { Skeleton } from "~/client/shared/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/client/shared/components/ui/tooltip";
import { clientErrorMessage } from "~/client/shared/error/ApiError";
import { usePrefs } from "~/client/shared/hooks/usePrefs";
import { getDictionary } from "~/client/shared/i18n/dictionary";
import { useApp } from "~/client/shared/stores/app";
import type {
  MonthlyExpenseDTO,
  PayMonthlyExpenseRequestDTO,
} from "~/contracts/http/cash-flow/monthly-expense";
import { BillsMonthSelect } from "./BillsMonthSelect";
import { MonthlyExpenseDialog } from "./MonthlyExpenseDialog";
import type { MonthlyExpenseFormValue } from "./MonthlyExpenseForm";
import { MonthlyExpensePaymentDialog } from "./MonthlyExpensePaymentDialog";
import { MonthlyExpenseProgress } from "./MonthlyExpenseProgress";
import { MonthlyExpenseRow } from "./MonthlyExpenseRow";

export function BillsScreen({ search }: { search: BillsSearch }) {
  const navigate = useNavigate();
  const resetFeature = useApp((state) => state.resetMonthlyExpenses);
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
  const payFromAccount = useApp((state) => state.payMonthlyExpenseFromAccount);
  const dashboard = useApp((state) => state.cashFlowDashboard);
  const loadAccounts = useApp((state) => state.bootstrapCashFlow);
  const isLoadingAccounts = useApp((state) => state.isCashFlowBootstrapping);
  const accountError = useApp((state) => state.cashFlowError);
  const [payingExpenseId, setPayingExpenseId] = useState<string>();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<MonthlyExpenseDTO>();
  const payingExpense = monthlyExpenses.find(
    (item) => item.id === payingExpenseId,
  );
  const isDialogOpen = isCreateOpen || editingExpense !== undefined;
  const dictionary = getDictionary(prefs.locale);
  const t = dictionary.billsPage;
  const currentMonth = getCurrentBillsMonth();
  const selectedMonth = search.month ?? currentMonth;
  const _unpaidCount = monthlyExpenses.filter(
    (expense) => !expense.isPaid,
  ).length;
  const _monthLabel = new Intl.DateTimeFormat(
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
  const errorMessage = clientErrorMessage(error, errorMessages);

  function onOpenPayment(id: string) {
    clearError();
    setPayingExpenseId(id);
    void loadAccounts();
  }

  async function onPayFromAccount(dto: PayMonthlyExpenseRequestDTO) {
    if (!payingExpense) return;
    const paid = await payFromAccount(payingExpense.id, dto);
    if (!paid) return;
    setPayingExpenseId(undefined);
    await loadAccounts();
  }

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
        category: value.category ?? null,
        defaultBankAccount: value.defaultBankAccount ?? null,
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
    setPayingExpenseId(undefined);
    navigate({
      to: "/bills",
      search: toBillsRouteSearch(nextMonth),
    });
  }

  useEffect(() => resetFeature, [resetFeature]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

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
    <AppShell
      activePath="/bills"
      dictionary={dictionary}
      showLogout
      title={t.windowTitle}
      wide
    >
      <TerminalPageHeader
        actions={
          <Button onClick={onOpenCreate} type="button">
            <Plus />
            {t.createPrompt}
          </Button>
        }
        heading={t.heading}
        subtitle={t.subtitle}
      />
      {errorMessage ? (
        <Alert className="mb-4" variant="destructive">
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
      <section aria-label={t.monthNavigationLabel} className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Field className="w-full min-w-0 gap-1.5 sm:w-auto sm:min-w-72">
            <FieldLabel className="sr-only" htmlFor="bills-month">
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
          {search.month !== undefined && (
            <Button
              onClick={() => onMonthSelect(currentMonth)}
              type="button"
              variant="ghost"
            >
              {t.currentMonthAction}
            </Button>
          )}
        </div>
        <p
          className="mt-2 mb-0 text-muted-foreground text-xs"
          id="bills-month-description"
        >
          {t.monthHistoryHint}
        </p>
      </section>
      <MonthlyExpenseProgress
        expenses={monthlyExpenses}
        hiddenMonetaryValueLabel={dictionary.common.hiddenMonetaryValue}
        locale={prefs.locale}
        t={t}
      />
      <section aria-labelledby="monthly-bills-list" className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2
            className="m-0 font-medium text-foreground text-sm"
            id="monthly-bills-list"
          >
            {t.listLabel}
          </h2>
          <p className="m-0 text-muted-foreground text-xs">{t.listHint}</p>
        </div>
        {isBootstrapping ? (
          <MonthlyExpenseListSkeleton label={t.loading} />
        ) : monthlyExpenses.length > 0 ? (
          <ul className="m-0 list-none divide-y divide-border overflow-hidden rounded-xl border border-border bg-card p-0">
            {monthlyExpenses.map((expense) => (
              <li key={expense.id}>
                <MonthlyExpenseRow
                  bankAccount={
                    dashboard.transactions.find(
                      (transaction) =>
                        transaction.paymentId ===
                        `${expense.id}:${expense.month}`,
                    )?.bankAccount
                  }
                  expense={expense}
                  hiddenMonetaryValueLabel={
                    dictionary.common.hiddenMonetaryValue
                  }
                  isSubmitting={isSubmitting}
                  locale={prefs.locale}
                  onEdit={() => onOpenEdit(expense)}
                  onPayFromAccount={() => onOpenPayment(expense.id)}
                  onTogglePaid={() => setPaid(expense.id, !expense.isPaid)}
                  t={t}
                />
              </li>
            ))}
          </ul>
        ) : (
          <ListEmptyState
            actions={
              <Button onClick={onOpenCreate} type="button">
                <Plus />
                {t.createPrompt}
              </Button>
            }
            description={t.emptyHint}
            icon={ReceiptText}
            title={t.emptyState}
          />
        )}
      </section>
      {payingExpense && (
        <MonthlyExpensePaymentDialog
          bankAccounts={dashboard.bankAccounts}
          categories={dashboard.expenseCategories}
          expense={payingExpense}
          hiddenMonetaryValueLabel={dictionary.common.hiddenMonetaryValue}
          isLoading={isLoadingAccounts}
          isSubmitting={isSubmitting}
          key={`${payingExpense.id}:${payingExpense.month}`}
          loadError={accountError !== undefined}
          locale={prefs.locale}
          onClose={() => setPayingExpenseId(undefined)}
          onSave={(dto) => void onPayFromAccount(dto)}
          paymentError={error === "saving"}
          t={t}
        />
      )}
      <MonthlyExpenseDialog
        bankAccounts={dashboard.bankAccounts}
        canArchive={selectedMonth === currentMonth}
        categories={dashboard.expenseCategories}
        expense={editingExpense}
        isSubmitting={isSubmitting}
        onClose={onCloseDialog}
        onDelete={onDelete}
        onSave={onSaveDialog}
        open={isDialogOpen}
        t={t}
      />
    </AppShell>
  );
}

function MonthlyExpenseListSkeleton({ label }: { label: string }) {
  return (
    <div aria-label={label} className="space-y-2" role="status">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((item) => (
        <Card
          aria-hidden="true"
          className="gap-0 border-border border-l-2 bg-background/45 shadow-none data-[size=sm]:py-0"
          key={item}
          size="sm"
        >
          <CardContent className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 py-2.5">
            <Skeleton className="size-4 rounded-sm" />
            <div className="space-y-1">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <div className="flex items-center gap-0.5">
              <Skeleton className="pointer-fine:size-7 size-11" />
              <Skeleton className="pointer-fine:size-7 size-11" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
