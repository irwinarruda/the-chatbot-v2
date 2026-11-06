import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRightLeft,
  CircleAlert,
  Landmark,
  Plus,
  RefreshCw,
  SearchX,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { CashFlowErrorCode } from "~/client/modules/cash-flow/app/services/CashFlowService";
import { calculateCashFlowNetBalance } from "~/client/modules/cash-flow/parsers/CashFlowBalances";
import {
  type CashFlowFilterValues,
  type CashFlowSearch,
  filterCashFlowTransactions,
  toCashFlowRouteSearch,
} from "~/client/modules/cash-flow/parsers/CashFlowSearch";
import { ListEmptyState } from "~/client/shared/components/ListEmptyState";
import { MonetaryValue } from "~/client/shared/components/MonetaryValue";
import { AppShell } from "~/client/shared/components/terminal/AppShell";
import { TerminalPageHeader } from "~/client/shared/components/terminal/TerminalPageHeader";
import {
  Alert,
  AlertAction,
  AlertDescription,
} from "~/client/shared/components/ui/alert";
import { Button } from "~/client/shared/components/ui/button";
import { cn } from "~/client/shared/components/ui/lib/utils";
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
  CreateCashFlowTransactionRequestDTO,
  SyncCashFlowBankAccountRequestDTO,
} from "~/contracts/http/cash-flow/cash-flow";
import type { SaveCashFlowTransferRequestDTO } from "~/contracts/http/cash-flow/cash-flow-transfer";
import { formatCashFlowDate } from "~/domain/cash-flow/cash-flow-date";
import { CashFlowFilters } from "./CashFlowFilters";
import { CashFlowSyncDialog } from "./CashFlowSyncDialog";
import { CashFlowTransactionDialog } from "./CashFlowTransactionDialog";
import { CashFlowTransactionList } from "./CashFlowTransactionList";
import { CashFlowTransferDialog } from "./CashFlowTransferDialog";

const loadingRows = ["first", "second", "third", "fourth"];

export function CashFlowScreen({ search }: { search: CashFlowSearch }) {
  const navigate = useNavigate();
  const resetFeature = useApp((state) => state.resetCashFlow);
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
  const saveTransfer = useApp((state) => state.saveCashFlowTransfer);
  const deleteTransfer = useApp((state) => state.deleteCashFlowTransfer);
  const [transferDraft, setTransferDraft] =
    useState<SaveCashFlowTransferRequestDTO>();
  const [editingTransferId, setEditingTransferId] = useState<string>();
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
  const errorMessage = clientErrorMessage(error, errorMessages);
  const hasFilters = Object.values(filters).some(
    (value) => value && value !== "all",
  );

  function onOpenTransfer(id?: string) {
    clearError();
    setEditingTransferId(id);
    const entries = dashboard.transactions.filter(
      (item) => id && item.transferId === id,
    );
    const debit = entries.find((item) => item.value < 0);
    const credit = entries.find((item) => item.value > 0);
    setTransferDraft({
      id: id ?? crypto.randomUUID(),
      from: debit?.bankAccount ?? dashboard.bankAccounts[0] ?? "",
      to: credit?.bankAccount ?? "",
      value: Math.abs(debit?.value ?? 0),
      date: debit?.date ?? formatCashFlowDate(new Date()),
      description: debit?.description ?? "",
    });
  }

  async function onSaveTransfer(value: SaveCashFlowTransferRequestDTO) {
    if (await saveTransfer(value, editingTransferId !== undefined))
      setTransferDraft(undefined);
  }

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

  useEffect(() => resetFeature, [resetFeature]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <AppShell
      activePath="/cash-flow"
      dictionary={dictionary}
      showLogout
      title={t.windowTitle}
      wide
    >
      <TerminalPageHeader
        actions={
          <>
            <Button
              aria-label={t.transferAction}
              disabled={isBootstrapping || isSubmitting}
              onClick={() => onOpenTransfer()}
              type="button"
              variant="outline"
            >
              <ArrowRightLeft />
              {t.transferShort}
            </Button>
            <Button
              aria-label={t.syncAction}
              disabled={isBootstrapping || dashboard.bankAccounts.length === 0}
              onClick={() => setIsSyncOpen(true)}
              type="button"
              variant="outline"
            >
              <RefreshCw />
              {t.syncShort}
            </Button>
            <Button
              disabled={isBootstrapping || dashboard.bankAccounts.length === 0}
              onClick={() => setIsCreateOpen(true)}
              type="button"
            >
              <Plus />
              {t.newTransaction}
            </Button>
          </>
        }
        heading={t.heading}
        subtitle={t.subtitle}
      />
      {errorMessage && (
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
      )}
      {dashboard.bankAccountStatuses.length > 0 && (
        <section
          aria-labelledby="cash-flow-balances"
          className="mb-6 rounded-xl border border-border bg-card"
        >
          <div className="px-5 pt-4 pb-4">
            <h2
              className="m-0 font-medium text-muted-foreground text-sm"
              id="cash-flow-balances"
            >
              {t.netBalanceLabel}
            </h2>
            <p
              className={cn(
                "m-0 mt-1 font-semibold text-3xl tabular-nums tracking-tight",
                netBalance < 0 ? "text-destructive" : "text-foreground",
              )}
            >
              <MonetaryValue
                hiddenLabel={dictionary.common.hiddenMonetaryValue}
              >
                {currency.format(netBalance)}
              </MonetaryValue>
            </p>
          </div>
          <ul
            aria-label={t.accountBalancesLabel}
            className="m-0 grid list-none grid-cols-1 divide-y divide-border border-border border-t p-0 sm:grid-cols-3 sm:divide-x sm:divide-y-0"
          >
            {dashboard.bankAccountStatuses.map((account) => (
              <li
                className="flex items-baseline justify-between gap-3 px-5 py-3 sm:block"
                key={account.bankAccount}
              >
                <p className="m-0 flex items-center gap-1.5 truncate text-muted-foreground text-xs">
                  <Landmark className="size-3.5 shrink-0" aria-hidden="true" />
                  {account.bankAccount}
                </p>
                <p
                  className={cn(
                    "m-0 font-medium text-base tabular-nums sm:mt-1",
                    account.balance < 0
                      ? "text-destructive"
                      : "text-foreground",
                  )}
                >
                  <MonetaryValue
                    hiddenLabel={dictionary.common.hiddenMonetaryValue}
                  >
                    {currency.format(account.balance)}
                  </MonetaryValue>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="mb-4">
        <CashFlowFilters
          bankAccounts={dashboard.bankAccounts}
          categories={categories}
          filters={filters}
          onChange={onChangeFilters}
          onClear={onClearFilters}
          t={t}
        />
      </div>
      <section aria-labelledby="cash-flow-list" className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2
            className="m-0 font-medium text-foreground text-sm"
            id="cash-flow-list"
          >
            {t.listLabel}
          </h2>
          <span className="text-muted-foreground text-xs tabular-nums">
            {filteredTransactions.length} {t.results}
          </span>
        </div>
        {isBootstrapping ? (
          <div aria-busy="true" aria-live="polite" className="space-y-2">
            <span className="sr-only">{t.loading}</span>
            {loadingRows.map((row) => (
              <Skeleton
                className="h-16 w-full rounded-lg border border-border bg-muted/50"
                key={row}
              />
            ))}
          </div>
        ) : filteredTransactions.length > 0 ? (
          <CashFlowTransactionList
            currency={currency}
            hiddenMonetaryValueLabel={dictionary.common.hiddenMonetaryValue}
            isSubmitting={isSubmitting}
            key={transactionListKey}
            locale={prefs.locale}
            onDelete={() => void deleteLastTransaction()}
            onEditTransfer={onOpenTransfer}
            onDeleteTransfer={(id) => void deleteTransfer(id)}
            t={t}
            transactions={filteredTransactions}
          />
        ) : (
          <ListEmptyState
            actions={
              hasFilters && (
                <Button
                  onClick={onClearFilters}
                  type="button"
                  variant="outline"
                >
                  <X />
                  {t.clearFilters}
                </Button>
              )
            }
            description={hasFilters ? t.noResultsHint : t.emptyHint}
            icon={hasFilters ? SearchX : WalletCards}
            title={hasFilters ? t.noResults : t.emptyState}
          />
        )}
      </section>
      {transferDraft && (
        <CashFlowTransferDialog
          bankAccounts={dashboard.bankAccounts}
          error={errorMessage}
          initialValue={transferDraft}
          isEditing={editingTransferId !== undefined}
          isSubmitting={isSubmitting}
          key={transferDraft.id}
          onClose={() => setTransferDraft(undefined)}
          onSave={(value) => void onSaveTransfer(value)}
          t={t}
        />
      )}
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
    </AppShell>
  );
}
