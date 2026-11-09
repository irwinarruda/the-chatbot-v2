import { useEffect, useRef, useState } from "react";
import { Button } from "~/client/shared/components/ui/button";
import type { Dictionary, Locale } from "~/client/shared/i18n/dictionary";
import type { CashFlowTransactionResponseDTO } from "~/contracts/http/cash-flow/cash-flow";
import { CashFlowTransactionRow } from "./CashFlowTransactionRow";

const transactionBatchSize = 20;

export function CashFlowTransactionList({
  currency,
  hiddenMonetaryValueLabel,
  isSubmitting,
  locale,
  onDelete,
  onEditTransfer,
  onDeleteTransfer,
  t,
  transactions,
}: {
  currency: Intl.NumberFormat;
  hiddenMonetaryValueLabel: string;
  isSubmitting: boolean;
  locale: Locale;
  onDelete: () => void;
  onEditTransfer?: (id: string) => void;
  onDeleteTransfer?: (id: string) => void;
  t: Dictionary["cashFlowPage"];
  transactions: CashFlowTransactionResponseDTO[];
}) {
  const loadMoreRef = useRef<HTMLButtonElement>(null);
  const [visibleCount, setVisibleCount] = useState(transactionBatchSize);
  const visibleTransactions = transactions.slice(0, visibleCount);
  const hasMore = visibleTransactions.length < transactions.length;

  function onLoadMore() {
    setVisibleCount((current) =>
      Math.min(current + transactionBatchSize, transactions.length),
    );
  }

  useEffect(() => {
    const loadMore = loadMoreRef.current;
    if (!loadMore || !hasMore || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setVisibleCount((current) =>
          Math.min(current + transactionBatchSize, transactions.length),
        );
      },
      { rootMargin: "240px 0px" },
    );
    observer.observe(loadMore);
    return () => observer.disconnect();
  }, [hasMore, transactions.length]);

  return (
    <>
      <ul className="m-0 list-none divide-y divide-border overflow-hidden rounded-xl border border-border bg-card p-0">
        {visibleTransactions.map((transaction) => (
          <li key={transaction.position}>
            <CashFlowTransactionRow
              currency={currency}
              hiddenMonetaryValueLabel={hiddenMonetaryValueLabel}
              isSubmitting={isSubmitting}
              locale={locale}
              onDelete={() => {
                if (transaction.transferId) {
                  onDeleteTransfer?.(transaction.transferId);
                  return;
                }
                onDelete();
              }}
              onEditTransfer={() => {
                if (transaction.transferId)
                  onEditTransfer?.(transaction.transferId);
              }}
              t={t}
              transaction={transaction}
            />
          </li>
        ))}
      </ul>
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            className="text-muted-foreground hover:bg-brand-soft hover:text-brand-text"
            onClick={onLoadMore}
            ref={loadMoreRef}
            size="sm"
            type="button"
            variant="ghost"
          >
            {t.loadMoreAction}
          </Button>
        </div>
      )}
    </>
  );
}
