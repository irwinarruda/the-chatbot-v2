import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/client/shared/components/ui/empty";
import { cn } from "~/client/shared/components/ui/lib/utils";

export function ListEmptyState({
  actions,
  className,
  description,
  icon: Icon,
  title,
}: {
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
  icon: LucideIcon;
  title: ReactNode;
}) {
  return (
    <Empty
      className={cn(
        "gap-4 rounded-xl border border-border border-dashed px-6 py-12",
        className,
      )}
    >
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className="size-10 rounded-full bg-muted text-muted-foreground"
        >
          <Icon className="size-5" aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle className="font-medium text-foreground text-sm">
          {title}
        </EmptyTitle>
        {description && (
          <EmptyDescription className="text-muted-foreground text-sm">
            {description}
          </EmptyDescription>
        )}
      </EmptyHeader>
      {actions && (
        <EmptyContent className="flex-row flex-wrap justify-center gap-2">
          {actions}
        </EmptyContent>
      )}
    </Empty>
  );
}
