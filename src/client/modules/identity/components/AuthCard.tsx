import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "~/client/shared/components/ui/lib/utils";

export function AuthCard({
  actions,
  children,
  footnote,
  heading,
  icon: Icon,
  iconClassName,
  subtitle,
}: {
  actions?: ReactNode;
  children?: ReactNode;
  footnote?: ReactNode;
  heading: string;
  icon: LucideIcon;
  iconClassName?: string;
  subtitle?: string;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 text-center shadow-scrim/10 shadow-sm sm:p-8">
      <span
        className={cn(
          "mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand-text",
          iconClassName,
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h1 className="m-0 text-balance font-display font-semibold text-foreground text-title-sm tracking-tight">
        {heading}
      </h1>
      {subtitle && (
        <p className="m-0 mt-1 text-muted-foreground text-sm">{subtitle}</p>
      )}
      {children && (
        <div className="mt-4 text-pretty text-muted-foreground text-sm leading-relaxed">
          {children}
        </div>
      )}
      {actions && <div className="mt-6 flex flex-col gap-2">{actions}</div>}
      {footnote && (
        <p className="m-0 mt-4 text-muted-foreground text-xs">{footnote}</p>
      )}
    </section>
  );
}
