import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { usePrefs } from "~/client/components/PrefsProvider";
import { cn } from "~/client/components/ui/lib";
import type { Dictionary } from "~/client/i18n";
import { TerminalChromeButton } from "./TerminalChromeButton";

type TerminalPath = "/" | "/privacy" | "/chat";

export function TerminalWindow({
  activePath = "/",
  chromeControls,
  children,
  dictionary,
  frameClassName,
  mainClassName,
  showNavigation,
  showShadow = true,
  title,
  wide = false,
  windowClassName,
}: {
  activePath?: TerminalPath;
  chromeControls?: ReactNode;
  children: ReactNode;
  dictionary?: Pick<Dictionary, "nav">;
  frameClassName?: string;
  mainClassName?: string;
  showNavigation?: boolean;
  showShadow?: boolean;
  title: string;
  wide?: boolean;
  windowClassName?: string;
}) {
  const { locale, theme, toggleLocale, toggleTheme } = usePrefs();

  const navLinks = dictionary
    ? [
        { label: dictionary.nav.home, href: "/" as const },
        { label: dictionary.nav.privacy, href: "/privacy" as const },
        { label: dictionary.nav.chat, href: "/chat" as const },
      ]
    : [];
  const shouldShowNavigation = showNavigation ?? dictionary !== undefined;
  const widthClass = wide ? "max-w-4xl" : "max-w-xl";

  return (
    <main
      className={cn(
        "flex min-h-dvh items-start justify-center bg-term-bg p-0",
        "sm:p-6 md:p-10",
        mainClassName,
      )}
    >
      <div className={cn(`flex w-full ${widthClass} flex-col`, frameClassName)}>
        <div className="flex items-center gap-3 border-b-0 bg-term-chrome px-3 py-2 sm:rounded-t-xl sm:border sm:border-term-border sm:px-4">
          <div className="flex shrink-0 gap-2" aria-hidden="true">
            <span className="h-3 w-3 rounded-full bg-term-red" />
            <span className="h-3 w-3 rounded-full bg-term-yellow" />
            <span className="h-3 w-3 rounded-full bg-term-green-dot" />
          </div>
          <span className="mx-auto min-w-0 select-none truncate px-2 text-term-muted text-xs tracking-wide">
            {title}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            {chromeControls ?? (
              <>
                <TerminalChromeButton onClick={toggleLocale} title={locale}>
                  {locale === "pt-BR" ? "PT" : "EN"}
                </TerminalChromeButton>
                <TerminalChromeButton
                  onClick={toggleTheme}
                  title={theme === "light" ? "dark" : "light"}
                >
                  {theme === "light" ? "\u2600" : "\u263D"}
                </TerminalChromeButton>
              </>
            )}
          </div>
        </div>

        <div
          className={cn(
            "flex-1 bg-term-window p-6 sm:rounded-b-xl sm:border",
            "sm:border-term-border sm:border-t-0 sm:p-9",
            "sm:shadow-2xl sm:shadow-black/10 md:p-10",
            windowClassName,
          )}
        >
          {shouldShowNavigation && dictionary ? (
            <nav className="mb-7 flex flex-wrap items-center gap-x-6 gap-y-1 text-base">
              {navLinks.map((link) => {
                const isActive = link.href === activePath;
                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    aria-current={isActive ? "page" : undefined}
                    className={
                      isActive
                        ? "font-medium text-term-green transition-colors duration-200 hover:text-term-cyan"
                        : "text-term-blue transition-colors duration-200 hover:text-term-cyan"
                    }
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          ) : null}

          {children}
        </div>

        {showShadow ? (
          <div
            className="mx-4 hidden h-2 rounded-b-xl bg-black/20 blur-sm sm:block"
            aria-hidden="true"
          />
        ) : null}
      </div>
    </main>
  );
}
