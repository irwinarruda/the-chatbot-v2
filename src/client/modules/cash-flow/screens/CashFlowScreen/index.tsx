import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRightLeft,
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
import type { CashFlowErrorCode } from "~/client/modules/cash-flow/app/services/CashFlowService";
import { calculateCashFlowNetBalance } from "~/client/modules/cash-flow/parsers/CashFlowBalances";
import {
  type CashFlowFilterValues,
  type CashFlowSearch,
  filterCashFlowTransactions,
  toCashFlowRouteSearch,
} from "~/client/modules/cash-flow/parsers/CashFlowSearch";
import { MonetaryValue } from "~/client/shared/components/MonetaryValue";
import { TerminalPageHeader } from "~/client/shared/components/terminal/TerminalPageHeader";
import { TerminalWindow } from "~/client/shared/components/terminal/TerminalWindow";
import {
  Alert,
  AlertAction,
  AlertDescription,
} from "~/client/shared/components/ui/alert";
import { Badge } from "~/client/shared/components/ui/badge";
import { Button } from "~/client/shared/components/ui/button";
import { Card, CardContent } from "~/client/shared/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/client/shared/components/ui/empty";
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

function balanceColorClassName(balance: number): string {
  if (balance < 0) return "text-destructive";
  return "text-success";
}

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
              className="gap-1.5 border-syntax-constant/40 bg-syntax-constant/10 text-syntax-constant"
              variant="outline"
            >
              <WalletCards />
              {dashboard.transactions.length} {t.transactions}
            </Badge>
            <Badge
              className="gap-1.5 border-info/40 bg-info/10 text-info hover:border-info hover:bg-info/15 hover:text-info"
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
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Button
          className="col-span-2 h-auto pointer-fine:h-auto min-h-11 pointer-fine:min-h-8 min-w-0 whitespace-normal pointer-fine:py-1 py-2 sm:col-span-1"
          disabled={isBootstrapping || dashboard.bankAccounts.length === 0}
          onClick={() => setIsCreateOpen(true)}
          type="button"
        >
          <Plus />
          {t.newTransaction}
        </Button>
        <Button
          className="h-auto pointer-fine:h-auto min-h-11 pointer-fine:min-h-8 min-w-0 whitespace-normal pointer-fine:py-1 py-2"
          disabled={isBootstrapping || isSubmitting}
          onClick={() => onOpenTransfer()}
          type="button"
          variant="outline"
        >
          <ArrowRightLeft />
          <span>{t.transferAction}</span>
        </Button>
        <Button
          className="h-auto pointer-fine:h-auto min-h-11 pointer-fine:min-h-8 min-w-0 whitespace-normal pointer-fine:py-1 py-2"
          disabled={isBootstrapping || dashboard.bankAccounts.length === 0}
          onClick={() => setIsSyncOpen(true)}
          type="button"
          variant="outline"
        >
          <RefreshCw />
          <span>{t.syncAction}</span>
        </Button>
      </div>
      {dashboard.bankAccountStatuses.length > 0 && (
        <section aria-labelledby="cash-flow-balances" className="mb-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2
              className="m-0 flex items-center gap-2 font-mono text-2xs text-muted-foreground uppercase tracking-wide"
              id="cash-flow-balances"
            >
              <Landmark className="size-3.5 text-primary" />
              {t.accountBalancesLabel}
            </h2>
            <p className="m-0 flex shrink-0 items-baseline gap-1.5 text-2xs text-muted-foreground">
              <span>{t.netBalanceLabel}</span>
              <strong
                className={cn(
                  "font-semibold tabular-nums",
                  balanceColorClassName(netBalance),
                )}
              >
                <MonetaryValue
                  hiddenLabel={dictionary.common.hiddenMonetaryValue}
                >
                  {currency.format(netBalance)}
                </MonetaryValue>
              </strong>
            </p>
          </div>
          <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 md:grid-cols-3">
            {dashboard.bankAccountStatuses.map((account) => (
              <Card
                className="min-w-48 gap-1 border-border bg-background/55 py-3 shadow-none sm:min-w-0"
                key={account.bankAccount}
                size="sm"
              >
                <CardContent className="px-3">
                  <p className="m-0 truncate text-2xs text-muted-foreground uppercase tracking-wide">
                    {account.bankAccount}
                  </p>
                  <p
                    className={cn(
                      "m-0 mt-1 font-semibold text-sm tabular-nums",
                      balanceColorClassName(account.balance),
                    )}
                  >
                    <MonetaryValue
                      hiddenLabel={dictionary.common.hiddenMonetaryValue}
                    >
                      {currency.format(account.balance)}
                    </MonetaryValue>
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
      <Card
        className="mb-4 gap-0 border-border bg-muted/45 py-0 shadow-none"
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
            className="m-0 flex items-center gap-2 font-mono text-2xs text-muted-foreground uppercase tracking-wide"
            id="cash-flow-list"
          >
            <ListFilter className="size-3.5 text-primary" />
            {t.listLabel}
          </h2>
          <span className="text-2xs text-muted-foreground tabular-nums">
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
          <Empty className="rounded-lg border border-border bg-background/40 py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <WalletCards className="text-primary" />
              </EmptyMedia>
              <EmptyTitle className="text-muted-foreground">
                {hasFilters ? t.noResults : t.emptyState}
              </EmptyTitle>
              <EmptyDescription>
                {hasFilters ? t.noResultsHint : t.emptyHint}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
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
    </TerminalWindow>
  );
}
