import type { ReactNode } from "react";
import { Button } from "~/client/shared/components/ui/button";
import { cn } from "~/client/shared/components/ui/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/client/shared/components/ui/tooltip";

export function TerminalChromeButton({
  children,
  className,
  onClick,
  pressed,
  title,
}: {
  children: ReactNode;
  className?: string;
  onClick: () => void;
  pressed?: boolean;
  title: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            onClick={onClick}
            aria-label={title}
            aria-pressed={pressed}
            variant="ghost"
            size="xs"
            className={cn(
              "min-h-6 gap-1 rounded-md border border-transparent px-2 py-0.5",
              "font-mono text-[0.6875rem] text-muted-foreground leading-none",
              "hover:border-border",
              className,
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}
