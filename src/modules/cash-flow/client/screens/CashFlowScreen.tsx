import { Link, useNavigate } from "@tanstack/react-router";
import {
  CircleAlert,
  Landmark,
  ListFilter,
  MessageSquare,
  Plus,
  RefreshCw,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { calculateCashFlowNetBalance } from "~/modules/cash-flow/client/CashFlowBalances";
import {
  type CashFlowFilterValues,
  type CashFlowSearch,
  filterCashFlowTransactions,
  toCashFlowRouteSearch,
} from "~/modules/cash-flow/client/CashFlowSearch";
import { CashFlowFilters } from "~/modules/cash-flow/client/components/CashFlowFilters";
import { CashFlowSyncDialog } from "~/modules/cash-flow/client/components/CashFlowSyncDialog";
import { CashFlowTransactionDialog } from "~/modules/cash-flow/client/components/CashFlowTransactionDialog";
import { CashFlowTransactionList } from "~/modules/cash-flow/client/components/CashFlowTransactionList";
import type { CashFlowErrorCode } from "~/modules/cash-flow/client/state/cashFlowSlice";
import type {
  CreateCashFlowTransactionRequestDTO,
  SyncCashFlowBankAccountRequestDTO,
} from "~/modules/cash-flow/entities/dtos/CashFlowWebDTO";
import { TerminalPageHeader } from "~/shared/client/components/terminal/TerminalPageHeader";
import { TerminalWindow } from "~/shared/client/components/terminal/TerminalWindow";
import {
  Alert,
  AlertAction,
  AlertDescription,
} from "~/shared/client/components/ui/alert";
import { Badge } from "~/shared/client/components/ui/badge";
import { Button } from "~/shared/client/components/ui/button";
import { Card, CardContent } from "~/shared/client/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/shared/client/components/ui/empty";
import { cn } from "~/shared/client/components/ui/lib";
import { Skeleton } from "~/shared/client/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/shared/client/components/ui/tooltip";
import { getDictionary } from "~/shared/client/i18n";
import { usePrefs } from "~/shared/client/providers/usePrefs";
import { useApp } from "~/shared/client/stores";

const loadingRows = ["first", "second", "third", "fourth"];

function balanceColorClassName(balance: number): string {
  if (balance < 0) return "text-term-red";
  return "text-term-green";
}

export function CashFlowScreen({ search }: { search: CashFlowSearch }) {
  const navigate = useNavigate();
  const prefs = usePrefs();
  const dashboard = useApp((state) => state.cashFlowDashboard);
  const isBootstrapping = useApp((state) => state.isCashFlowBootstrapping);
  const isSubmitting = useApp((state) => state.isCashFlowSubmitting);
  const error = useApp((state) => state.cashFlowError);
  const bootstrap = useApp((state) => state.bootstrapCashFlow);
  const createTransaction = useApp((state) => state.createCashFlowTransaction);
  const syncBankAccount = useApp((state) => state.syncCashFlowBankAccount);
  const deleteLastTransaction = useApp(
    (state) => state.deleteLastCashFlowTransaction,
  );
  const clearError = useApp((state) => state.clearCashFlowError);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const dictionary = getDictionary(prefs.locale);
  const t = dictionary.cashFlowPage;
  const filters: CashFlowFilterValues = {
    q: search.q ?? "",
    type: search.type ?? "all",
    bankAccount: search.bankAccount ?? "",
    category: search.category ?? "",
    from: search.from ?? "",
    to: search.to ?? "",
  };
  const categories = [
    ...new Set([
      ...dashboard.expenseCategories,
      ...dashboard.earningCategories,
    ]),
  ].sort((first, second) => first.localeCompare(second));
  const filteredTransactions = filterCashFlowTransactions(
    dashboard.transactions,
    filters,
  );
  const netBalance = calculateCashFlowNetBalance(dashboard.bankAccountStatuses);
  const transactionListKey = JSON.stringify({
    filters,
    transactionCount: dashboard.transactions.length,
    latestPosition: dashboard.transactions.at(-1)?.position,
  });
  const currency = new Intl.NumberFormat(
    prefs.locale === "pt-BR" ? "pt-BR" : "en-US",
    { style: "currency", currency: "BRL" },
  );
  const errorMessages: Record<CashFlowErrorCode, string> = {
    loading: t.errorLoading,
    saving: t.errorSaving,
    syncing: t.errorSyncing,
    deleting: t.errorDeleting,
  };
  const errorMessage = error ? errorMessages[error] : undefined;
  const hasFilters = Object.values(filters).some(
    (value) => value && value !== "all",
  );

  function onChangeFilters(patch: Partial<CashFlowFilterValues>) {
    navigate({
      to: "/cash-flow",
      search: toCashFlowRouteSearch({ ...filters, ...patch }),
      replace: true,
    });
  }

  function onClearFilters() {
    navigate({ to: "/cash-flow", search: {}, replace: true });
  }

  async function onCreate(value: CreateCashFlowTransactionRequestDTO) {
    const created = await createTransaction(value);
    if (created) setIsCreateOpen(false);
  }

  async function onSync(value: SyncCashFlowBankAccountRequestDTO) {
    const synced = await syncBankAccount(value);
    if (synced) setIsSyncOpen(false);
  }

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <TerminalWindow
      activePath="/cash-flow"
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
              className="gap-1.5 border-term-green/40 bg-term-green/5 text-term-green"
              variant="outline"
            >
              <WalletCards />
              {dashboard.transactions.length} {t.transactions}
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
      {errorMessage && (
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
      )}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <Button
          disabled={isBootstrapping || dashboard.bankAccounts.length === 0}
          onClick={() => setIsCreateOpen(true)}
          type="button"
        >
          <Plus />
          {t.newTransaction}
        </Button>
        <Button
          disabled={isBootstrapping || dashboard.bankAccounts.length === 0}
          onClick={() => setIsSyncOpen(true)}
          type="button"
          variant="outline"
        >
          <RefreshCw />
          {t.syncAction}
        </Button>
      </div>
      {dashboard.bankAccountStatuses.length > 0 && (
        <section aria-labelledby="cash-flow-balances" className="mb-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2
              className="m-0 flex items-center gap-2 font-mono text-2xs text-term-muted uppercase tracking-wide"
              id="cash-flow-balances"
            >
              <Landmark className="size-3.5 text-term-blue" />
              {t.accountBalancesLabel}
            </h2>
            <p className="m-0 flex shrink-0 items-baseline gap-1.5 text-2xs text-term-muted">
              <span>{t.netBalanceLabel}</span>
              <strong
                className={cn(
                  "font-semibold tabular-nums",
                  balanceColorClassName(netBalance),
                )}
              >
                {currency.format(netBalance)}
              </strong>
            </p>
          </div>
          <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 md:grid-cols-3">
            {dashboard.bankAccountStatuses.map((account) => (
              <Card
                className="min-w-48 gap-1 border-term-border bg-term-bg/55 py-3 shadow-none sm:min-w-0"
                key={account.bankAccount}
                size="sm"
              >
                <CardContent className="px-3">
                  <p className="m-0 truncate text-2xs text-term-muted uppercase tracking-wide">
                    {account.bankAccount}
                  </p>
                  <p
                    className={cn(
                      "m-0 mt-1 font-semibold text-sm tabular-nums",
                      balanceColorClassName(account.balance),
                    )}
                  >
                    {currency.format(account.balance)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
      <Card
        className="mb-4 gap-0 border-term-border bg-term-chrome/45 py-0 shadow-none"
        size="sm"
      >
        <CardContent className="p-3">
          <CashFlowFilters
            bankAccounts={dashboard.bankAccounts}
            categories={categories}
            filters={filters}
            onChange={onChangeFilters}
            onClear={onClearFilters}
            t={t}
          />
        </CardContent>
      </Card>
      <section aria-labelledby="cash-flow-list" className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2
            className="m-0 flex items-center gap-2 font-mono text-2xs text-term-muted uppercase tracking-wide"
            id="cash-flow-list"
          >
            <ListFilter className="size-3.5 text-term-green" />
            {t.listLabel}
          </h2>
          <span className="text-2xs text-term-muted tabular-nums">
            {filteredTransactions.length} {t.results}
          </span>
        </div>
        {isBootstrapping ? (
          <div aria-busy="true" aria-live="polite" className="space-y-2">
            <span className="sr-only">{t.loading}</span>
            {loadingRows.map((row) => (
              <Skeleton
                className="h-16 w-full rounded-lg border border-term-border bg-term-chrome/50"
                key={row}
              />
            ))}
          </div>
        ) : filteredTransactions.length > 0 ? (
          <CashFlowTransactionList
            currency={currency}
            isSubmitting={isSubmitting}
            key={transactionListKey}
            locale={prefs.locale}
            onDelete={() => void deleteLastTransaction()}
            t={t}
            transactions={filteredTransactions}
          />
        ) : (
          <Empty className="rounded-lg border border-term-border bg-term-bg/40 py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <WalletCards className="text-term-green" />
              </EmptyMedia>
              <EmptyTitle className="text-term-muted">
                {hasFilters ? t.noResults : t.emptyState}
              </EmptyTitle>
              <EmptyDescription>
                {hasFilters ? t.noResultsHint : t.emptyHint}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>
      <CashFlowTransactionDialog
        bankAccounts={dashboard.bankAccounts}
        earningCategories={dashboard.earningCategories}
        expenseCategories={dashboard.expenseCategories}
        isSubmitting={isSubmitting}
        onClose={() => setIsCreateOpen(false)}
        onSave={(value) => void onCreate(value)}
        open={isCreateOpen}
        t={t}
      />
      <CashFlowSyncDialog
        bankAccounts={dashboard.bankAccounts}
        categories={categories}
        isSubmitting={isSubmitting}
        onClose={() => setIsSyncOpen(false)}
        onSave={(value) => void onSync(value)}
        open={isSyncOpen}
        t={t}
      />
    </TerminalWindow>
  );
}
