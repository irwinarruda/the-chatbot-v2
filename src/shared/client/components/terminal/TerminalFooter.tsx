import type { ReactNode } from "react";
import { cn } from "~/shared/client/components/ui/lib";
import { Separator } from "~/shared/client/components/ui/separator";

export function TerminalFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("text-[0.8125rem] text-term-muted", className)}>
      <Separator className="mb-5 bg-term-border" />
      {children}
    </div>
  );
}
