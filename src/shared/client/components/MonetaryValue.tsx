import type { ReactNode } from "react";
import { cn } from "~/shared/client/components/ui/lib";
import { useApp } from "~/shared/client/stores";

export function MonetaryValue({
  children,
  className,
  hiddenLabel,
}: {
  children: ReactNode;
  className?: string;
  hiddenLabel: string;
}) {
  const isMoneyHidden = useApp((state) => state.isMoneyHidden);
  const isMoneyPrivacyHydrated = useApp(
    (state) => state.isMoneyPrivacyHydrated,
  );

  if (!isMoneyPrivacyHydrated || isMoneyHidden) {
    return (
      <span className={cn("inline-block", className)}>
        <span className="sr-only">{hiddenLabel}</span>
        <span
          aria-hidden="true"
          className="inline-block w-[9ch] select-none overflow-hidden whitespace-nowrap text-term-muted blur-[5px]"
        >
          R$ 000,00
        </span>
      </span>
    );
  }

  return <span className={className}>{children}</span>;
}
