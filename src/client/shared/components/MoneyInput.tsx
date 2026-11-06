import type { ComponentProps } from "react";
import { Input } from "~/client/shared/components/ui/input";
import { cn } from "~/client/shared/components/ui/lib/utils";

export function MoneyInput({
  className,
  currencySymbol = "R$",
  ...props
}: ComponentProps<typeof Input> & { currencySymbol?: string }) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground text-sm"
      >
        {currencySymbol}
      </span>
      <Input className={cn("pl-9 tabular-nums", className)} {...props} />
    </div>
  );
}
