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
            size="icon-sm"
            className={cn(
              "font-medium font-mono text-muted-foreground text-xs",
              "hover:bg-muted hover:text-foreground",
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
