import type { ReactNode } from "react";
import { Button } from "~/shared/client/components/ui/button";
import { cn } from "~/shared/client/components/ui/lib";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/shared/client/components/ui/tooltip";

export function TerminalChromeButton({
  children,
  className,
  onClick,
  title,
}: {
  children: ReactNode;
  className?: string;
  onClick: () => void;
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
            variant="ghost"
            size="xs"
            className={cn(
              "min-h-6 gap-1 rounded-md border border-transparent px-2 py-0.5",
              "font-mono text-[0.6875rem] text-term-muted leading-none",
              "hover:border-term-border hover:bg-term-bg hover:text-term-bright",
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
