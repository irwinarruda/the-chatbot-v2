import type { ReactNode } from "react";
import { Card, CardContent } from "~/client/components/ui/card";

export function TerminalPanel({ children }: { children: ReactNode }) {
  return (
    <Card className="mb-6 border border-term-border bg-term-bg/70 shadow-none">
      <CardContent className="space-y-3 p-5">{children}</CardContent>
    </Card>
  );
}
