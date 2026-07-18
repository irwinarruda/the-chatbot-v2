import { ChevronLeft, ChevronRight } from "lucide-react";
import { shiftBillsMonth } from "~/modules/cash-flow/client/BillsSearch";
import { Button } from "~/shared/client/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/shared/client/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/shared/client/components/ui/tooltip";
import type { Locale } from "~/shared/client/i18n";

const DEFAULT_MONTH_WINDOW = 36;

function formatBillsMonthLabel(month: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "pt-BR" ? "pt-BR" : "en-US", {
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(`${month}-15T12:00:00.000Z`));
}

function listBillsMonthOptions(value: string, maxMonth: string) {
  const months: string[] = [];
  let month = maxMonth;
  for (let index = 0; index < DEFAULT_MONTH_WINDOW; index += 1) {
    months.push(month);
    month = shiftBillsMonth(month, -1);
  }
  while (value < months[months.length - 1]) {
    months.push(shiftBillsMonth(months[months.length - 1], -1));
  }
  return months;
}

export function BillsMonthSelect({
  id,
  describedBy,
  value,
  maxMonth,
  locale,
  previousMonthLabel,
  nextMonthLabel,
  onMonthChange,
}: {
  id: string;
  describedBy: string;
  value: string;
  maxMonth: string;
  locale: Locale;
  previousMonthLabel: string;
  nextMonthLabel: string;
  onMonthChange: (month: string) => void;
}) {
  const months = listBillsMonthOptions(value, maxMonth);
  const canGoNext = value < maxMonth;
  const selectedLabel = formatBillsMonthLabel(value, locale);

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={previousMonthLabel}
              onClick={() => onMonthChange(shiftBillsMonth(value, -1))}
              size="icon"
              type="button"
              variant="outline"
            />
          }
        >
          <ChevronLeft />
        </TooltipTrigger>
        <TooltipContent>{previousMonthLabel}</TooltipContent>
      </Tooltip>
      <Select
        onValueChange={(nextMonth) => {
          if (!nextMonth) return;
          onMonthChange(nextMonth);
        }}
        value={value}
      >
        <SelectTrigger
          aria-describedby={describedBy}
          className="w-full min-w-0"
          id={id}
        >
          <SelectValue>{selectedLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent align="start">
          {months.map((month) => (
            <SelectItem key={month} value={month}>
              {formatBillsMonthLabel(month, locale)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Tooltip>
        <TooltipTrigger
          disabled={!canGoNext}
          render={
            <Button
              aria-label={nextMonthLabel}
              disabled={!canGoNext}
              onClick={() => onMonthChange(shiftBillsMonth(value, 1))}
              size="icon"
              type="button"
              variant="outline"
            />
          }
        >
          <ChevronRight />
        </TooltipTrigger>
        <TooltipContent>{nextMonthLabel}</TooltipContent>
      </Tooltip>
    </div>
  );
}
