import type { ReactNode } from "react";
import { Separator } from "~/client/components/ui/separator";

export function TerminalFooter({ children }: { children: ReactNode }) {
  return (
    <div className="text-[0.8125rem] text-term-muted">
      <Separator className="mb-5 bg-term-border" />
      {children}
    </div>
  );
}
