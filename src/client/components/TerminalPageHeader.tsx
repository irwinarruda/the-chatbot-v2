import type { ReactNode } from "react";
import { ThemeLogo } from "~/client/components/ThemeLogo";

export function TerminalPageHeader({
  badge,
  heading,
  subtitle,
  withLogo = true,
}: {
  badge?: ReactNode;
  heading: string;
  subtitle?: string;
  withLogo?: boolean;
}) {
  return (
    <header className="mb-6 text-center">
      {withLogo ? <ThemeLogo /> : null}
      <h1 className="m-0 mb-1.5 font-bold text-2xl text-term-green tracking-tight sm:text-3xl">
        {heading}
      </h1>
      {subtitle ? (
        <p className="m-0 text-sm text-term-muted">{subtitle}</p>
      ) : null}
      {badge}
    </header>
  );
}
