import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { CashFlowFilterValues } from "~/client/modules/cash-flow/parsers/CashFlowSearch";
import { Button } from "~/client/shared/components/ui/button";
import { Field, FieldLabel } from "~/client/shared/components/ui/field";
import { Input } from "~/client/shared/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/client/shared/components/ui/native-select";
import type { Dictionary } from "~/client/shared/i18n/dictionary";
import { CashFlowTransactionType } from "~/domain/cash-flow/cash-flow-transaction-type";

export function CashFlowFilters({
  bankAccounts,
  categories,
  filters,
  onChange,
  onClear,
  t,
}: {
  bankAccounts: string[];
  categories: string[];
  filters: CashFlowFilterValues;
  onChange: (patch: Partial<CashFlowFilterValues>) => void;
  onClear: () => void;
  t: Dictionary["cashFlowPage"];
}) {
  const [query, setQuery] = useState(filters.q);
  const [isExpanded, setIsExpanded] = useState(
    filters.type !== "all" ||
      filters.bankAccount !== "" ||
      filters.category !== "" ||
      filters.from !== "" ||
      filters.to !== "",
  );

  useEffect(() => {
    setQuery(filters.q);
  }, [filters.q]);

  useEffect(() => {
    if (query === filters.q) return;
    const timeout = window.setTimeout(() => onChange({ q: query }), 300);
    return () => window.clearTimeout(timeout);
  }, [query, filters.q, onChange]);

  const advancedCount = [
    filters.type !== "all",
    filters.bankAccount !== "",
    filters.category !== "",
    filters.from !== "",
    filters.to !== "",
  ].filter(Boolean).length;
  const hasAnyFilter = advancedCount > 0 || filters.q !== "";

  function onClearAll() {
    setQuery("");
    onClear();
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={t.searchLabel}
            className="pl-8"
            id="cash-flow-filter-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.searchPlaceholder}
            type="search"
            value={query}
          />
        </div>
        <Button
          aria-controls="cash-flow-advanced-filters"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded(!isExpanded)}
          type="button"
          variant="outline"
        >
          <SlidersHorizontal />
          <span className="hidden sm:inline">{t.filtersAction}</span>
          {advancedCount > 0 && (
            <span className="rounded-full bg-brand/15 px-1.5 text-primary text-xs tabular-nums">
              {advancedCount}
            </span>
          )}
        </Button>
        {hasAnyFilter && (
          <Button onClick={onClearAll} type="button" variant="ghost">
            <X />
            <span className="hidden sm:inline">{t.clearFilters}</span>
          </Button>
        )}
      </div>
      <div
        className="space-y-3 rounded-xl border border-border bg-card p-3"
        hidden={!isExpanded}
        id="cash-flow-advanced-filters"
      >
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="cash-flow-filter-type">
              {t.transactionTypeLabel}
            </FieldLabel>
            <NativeSelect
              className="w-full"
              id="cash-flow-filter-type"
              onChange={(event) =>
                onChange({
                  type: event.target.value as CashFlowFilterValues["type"],
                })
              }
              value={filters.type}
            >
              <NativeSelectOption value="all">{t.allTypes}</NativeSelectOption>
              <NativeSelectOption value={CashFlowTransactionType.Expense}>
                {t.expense}
              </NativeSelectOption>
              <NativeSelectOption value={CashFlowTransactionType.Earning}>
                {t.earning}
              </NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="cash-flow-filter-account">
              {t.bankAccountLabel}
            </FieldLabel>
            <NativeSelect
              className="w-full"
              id="cash-flow-filter-account"
              onChange={(event) =>
                onChange({ bankAccount: event.target.value })
              }
              value={filters.bankAccount}
            >
              <NativeSelectOption value="">{t.allAccounts}</NativeSelectOption>
              {bankAccounts.map((account) => (
                <NativeSelectOption key={account} value={account}>
                  {account}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field className="sm:col-span-2 md:col-span-1">
            <FieldLabel htmlFor="cash-flow-filter-category">
              {t.categoryLabel}
            </FieldLabel>
            <NativeSelect
              className="w-full"
              id="cash-flow-filter-category"
              onChange={(event) => onChange({ category: event.target.value })}
              value={filters.category}
            >
              <NativeSelectOption value="">
                {t.allCategories}
              </NativeSelectOption>
              {categories.map((category) => (
                <NativeSelectOption key={category} value={category}>
                  {category}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 md:items-end">
          <Field>
            <FieldLabel htmlFor="cash-flow-filter-from">
              {t.fromDateLabel}
            </FieldLabel>
            <Input
              id="cash-flow-filter-from"
              max={filters.to || undefined}
              onChange={(event) => onChange({ from: event.target.value })}
              type="date"
              value={filters.from}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="cash-flow-filter-to">
              {t.toDateLabel}
            </FieldLabel>
            <Input
              id="cash-flow-filter-to"
              min={filters.from || undefined}
              onChange={(event) => onChange({ to: event.target.value })}
              type="date"
              value={filters.to}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}
