import type { ReactNode } from "react";

export function TerminalPageHeader({
  actions,
  heading,
  subtitle,
}: {
  actions?: ReactNode;
  heading: string;
  subtitle?: string;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0 flex-1 basis-64">
        <h1 className="m-0 text-balance font-semibold text-2xl text-foreground tracking-tight">
          {heading}
        </h1>
        {subtitle && (
          <p className="mt-1 hidden max-w-xl text-pretty text-muted-foreground text-sm leading-relaxed sm:block">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  );
}
