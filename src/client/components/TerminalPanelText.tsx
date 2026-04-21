import type { ReactNode } from "react";

export function TerminalPanelText({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 text-sm text-term-text leading-relaxed [&_strong]:font-semibold [&_strong]:text-term-bright">
      {children}
    </p>
  );
}
