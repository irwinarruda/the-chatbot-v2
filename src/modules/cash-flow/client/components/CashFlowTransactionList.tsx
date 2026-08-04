import { useEffect, useRef, useState } from "react";
import { CashFlowTransactionRow } from "~/modules/cash-flow/client/components/CashFlowTransactionRow";
import type { CashFlowTransactionResponseDTO } from "~/modules/cash-flow/entities/dtos/CashFlowWebDTO";
import { Button } from "~/shared/client/components/ui/button";
import type { Dictionary, Locale } from "~/shared/client/i18n";

const transactionBatchSize = 20;

export function CashFlowTransactionList({
  currency,
  isSubmitting,
  locale,
  onDelete,
  t,
  transactions,
}: {
  currency: Intl.NumberFormat;
  isSubmitting: boolean;
  locale: Locale;
  onDelete: () => void;
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
      <ul className="m-0 list-none space-y-2 p-0">
        {visibleTransactions.map((transaction) => (
          <li key={transaction.position}>
            <CashFlowTransactionRow
              currency={currency}
              isSubmitting={isSubmitting}
              locale={locale}
              onDelete={onDelete}
              t={t}
              transaction={transaction}
            />
          </li>
        ))}
      </ul>
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            className="text-term-muted hover:text-term-green"
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
