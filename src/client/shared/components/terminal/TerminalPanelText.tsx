import type { ReactNode } from "react";

export function TerminalPanelText({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 max-w-xl text-pretty text-foreground text-sm leading-relaxed [&_strong]:font-semibold">
      {children}
    </p>
  );
}
