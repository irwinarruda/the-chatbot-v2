import type { ReactNode } from "react";
import { cn } from "~/client/shared/components/ui/lib/utils";
import { Separator } from "~/client/shared/components/ui/separator";

export function TerminalFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <footer className={cn("text-[0.8125rem] text-muted-foreground", className)}>
      <Separator className="mb-5" />
      {children}
    </footer>
  );
}
