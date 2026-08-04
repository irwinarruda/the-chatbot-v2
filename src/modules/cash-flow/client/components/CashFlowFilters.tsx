import { CalendarDays, Landmark, Search, Tags, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { CashFlowFilterValues } from "~/modules/cash-flow/client/CashFlowSearch";
import { CashFlowTransactionType } from "~/modules/cash-flow/entities/enums/CashFlowTransactionType";
import { Button } from "~/shared/client/components/ui/button";
import { Field, FieldLabel } from "~/shared/client/components/ui/field";
import { Input } from "~/shared/client/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/shared/client/components/ui/native-select";
import type { Dictionary } from "~/shared/client/i18n";

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

  useEffect(() => {
    setQuery(filters.q);
  }, [filters.q]);

  useEffect(() => {
    if (query === filters.q) return;
    const timeout = window.setTimeout(() => onChange({ q: query }), 300);
    return () => window.clearTimeout(timeout);
  }, [query, filters.q, onChange]);

  return (
    <div className="space-y-3">
      <Field>
        <FieldLabel htmlFor="cash-flow-filter-search">
          <Search className="size-3.5 text-term-green" />
          {t.searchLabel}
        </FieldLabel>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-term-muted" />
          <Input
            className="pl-8"
            id="cash-flow-filter-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.searchPlaceholder}
            type="search"
            value={query}
          />
        </div>
      </Field>
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
            <Landmark className="size-3.5 text-term-blue" />
            {t.bankAccountLabel}
          </FieldLabel>
          <NativeSelect
            className="w-full"
            id="cash-flow-filter-account"
            onChange={(event) => onChange({ bankAccount: event.target.value })}
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
            <Tags className="size-3.5 text-term-magenta" />
            {t.categoryLabel}
          </FieldLabel>
          <NativeSelect
            className="w-full"
            id="cash-flow-filter-category"
            onChange={(event) => onChange({ category: event.target.value })}
            value={filters.category}
          >
            <NativeSelectOption value="">{t.allCategories}</NativeSelectOption>
            {categories.map((category) => (
              <NativeSelectOption key={category} value={category}>
                {category}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <Field>
          <FieldLabel htmlFor="cash-flow-filter-from">
            <CalendarDays className="size-3.5 text-term-amber" />
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
            <CalendarDays className="size-3.5 text-term-amber" />
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
        <Button
          className="w-full sm:col-span-2 md:col-span-1 md:w-auto"
          onClick={() => {
            setQuery("");
            onClear();
          }}
          type="button"
          variant="outline"
        >
          <X />
          {t.clearFilters}
        </Button>
      </div>
    </div>
  );
}
