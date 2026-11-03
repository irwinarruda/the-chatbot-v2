import type { ReactNode } from "react";
import { Card, CardContent } from "~/client/shared/components/ui/card";
import { Empty } from "~/client/shared/components/ui/empty";
import { cn } from "~/client/shared/components/ui/lib/utils";

export function TerminalPanel({
  centered = false,
  children,
  className,
  contentClassName,
}: {
  centered?: boolean;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  let content = children;
  if (centered) {
    content = (
      <Empty className="gap-3 rounded-none border-0 p-0 text-center">
        {children}
      </Empty>
    );
  }

  return (
    <Card
      size="sm"
      className={cn("mb-6 border-border/80 bg-muted/30 shadow-none", className)}
    >
      <CardContent className={cn("space-y-3 px-5 py-1", contentClassName)}>
        {content}
      </CardContent>
    </Card>
  );
}
