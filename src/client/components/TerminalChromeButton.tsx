import type { ReactNode } from "react";
import { Button } from "~/client/components/ui/button";
import { cn } from "~/client/components/ui/lib";

export function TerminalChromeButton({
  children,
  className,
  onClick,
  title,
}: {
  children: ReactNode;
  className?: string;
  onClick: () => void;
  title?: string;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      title={title}
      variant="ghost"
      size="xs"
      className={cn(
        "min-h-6 rounded border border-transparent px-1.5 py-0.5",
        "text-[0.6875rem] text-term-muted leading-none",
        "hover:border-term-border hover:bg-term-bg hover:text-term-bright",
        className,
      )}
    >
      {children}
    </Button>
  );
}
