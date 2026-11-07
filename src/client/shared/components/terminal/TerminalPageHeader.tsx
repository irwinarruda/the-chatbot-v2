import { Ellipsis, type LucideIcon } from "lucide-react";
import type { ReactElement } from "react";
import { Button } from "~/client/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/client/shared/components/ui/dropdown-menu";
import { cn } from "~/client/shared/components/ui/lib/utils";
import { useDictionary } from "~/client/shared/hooks/useDictionary";

export type PageAction = {
  icon: LucideIcon;
  isDisabled?: boolean;
  label: string;
  link?: ReactElement;
  onClick?: () => void;
  shortLabel?: string;
  shouldKeepLabel?: boolean;
};

export function TerminalPageHeader({
  heading,
  primaryAction,
  secondaryActions = [],
  subtitle,
}: {
  heading: string;
  primaryAction?: PageAction;
  secondaryActions?: PageAction[];
  subtitle?: string;
}) {
  const dictionary = useDictionary();
  const PrimaryIcon = primaryAction?.icon;

  return (
    <header className="mb-6 flex items-center justify-between gap-4 sm:items-end">
      <div className="min-w-0 flex-1">
        <h1 className="m-0 text-balance font-semibold text-2xl text-foreground tracking-tight">
          {heading}
        </h1>
        {subtitle && (
          <p className="mt-1 hidden max-w-xl text-pretty text-muted-foreground text-sm leading-relaxed sm:block">
            {subtitle}
          </p>
        )}
      </div>
      {(primaryAction || secondaryActions.length > 0) && (
        <div className="flex shrink-0 items-center gap-2">
          {secondaryActions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                aria-label={action.label}
                className="hidden md:inline-flex"
                disabled={action.isDisabled}
                key={action.label}
                nativeButton={!action.link}
                onClick={action.onClick}
                render={action.link}
                type={action.link ? undefined : "button"}
                variant="outline"
              >
                <Icon />
                {action.shortLabel ?? action.label}
              </Button>
            );
          })}
          {secondaryActions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    aria-label={dictionary.common.more}
                    className="md:hidden"
                    size="icon"
                    type="button"
                    variant="outline"
                  />
                }
              >
                <Ellipsis />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {secondaryActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <DropdownMenuItem
                      disabled={action.isDisabled}
                      key={action.label}
                      onClick={action.onClick}
                      render={action.link}
                    >
                      <Icon />
                      {action.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {primaryAction && PrimaryIcon && (
            <Button
              aria-label={primaryAction.label}
              className={cn(
                !primaryAction.shouldKeepLabel &&
                  "max-md:size-11 max-md:px-0 max-md:pointer-fine:size-8 max-md:pointer-fine:px-0",
              )}
              disabled={primaryAction.isDisabled}
              nativeButton={!primaryAction.link}
              onClick={primaryAction.onClick}
              render={primaryAction.link}
              type={primaryAction.link ? undefined : "button"}
            >
              <PrimaryIcon />
              <span
                className={cn(
                  !primaryAction.shouldKeepLabel && "max-md:sr-only",
                )}
              >
                {primaryAction.shortLabel ?? primaryAction.label}
              </span>
            </Button>
          )}
        </div>
      )}
    </header>
  );
}
