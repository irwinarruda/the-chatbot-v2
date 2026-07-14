import { Link, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "~/shared/client/components/ui/lib";
import type { Dictionary } from "~/shared/client/i18n";
import { usePrefs } from "~/shared/client/providers/usePrefs";
import { useApp } from "~/shared/client/stores";
import { TerminalChromeButton } from "./TerminalChromeButton";

type TerminalPath = "/" | "/privacy" | "/chat" | "/todo" | "/bills";

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
  const router = useRouter();
  const prefs = usePrefs();
  const toggleTheme = useApp((s) => s.toggleTheme);
  const toggleLocale = useApp((s) => s.toggleLocale);
  const navLinks = dictionary
    ? [
        { label: dictionary.nav.home, href: "/" as const },
        { label: dictionary.nav.privacy, href: "/privacy" as const },
        { label: dictionary.nav.chat, href: "/chat" as const },
        { label: dictionary.nav.todo, href: "/todo" as const },
        { label: dictionary.nav.bills, href: "/bills" as const },
      ]
    : [];
  const shouldShowNavigation = showNavigation ?? dictionary !== undefined;

  const onToggleLocale = async () => {
    await toggleLocale();
    router.invalidate();
  };

  const onGoHome = () => {
    router.navigate({ to: "/" });
  };

  return (
    <main
      className={cn(
        "flex min-h-dvh items-start justify-center bg-term-bg p-0 sm:p-6 md:p-10",
        mainClassName,
      )}
    >
      <div
        className={cn(
          "flex w-full flex-col",
          wide ? "max-w-4xl" : "max-w-xl",
          frameClassName,
        )}
      >
        <div className="flex items-center gap-3 border-b-0 bg-term-chrome px-3 py-2 sm:rounded-t-xl sm:border sm:border-term-border sm:px-4">
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onGoHome}
              title="close"
              aria-label="close"
              className="h-3 w-3 rounded-full bg-term-red transition-opacity hover:opacity-80"
            />
            <button
              type="button"
              onClick={onGoHome}
              title="minimize"
              aria-label="minimize"
              className="h-3 w-3 rounded-full bg-term-yellow transition-opacity hover:opacity-80"
            />
            <button
              type="button"
              onClick={onGoHome}
              title="resize"
              aria-label="resize"
              className="h-3 w-3 rounded-full bg-term-green-dot transition-opacity hover:opacity-80"
            />
          </div>
          <span className="mx-auto min-w-0 select-none truncate px-2 text-term-muted text-xs tracking-wide">
            {title}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            {chromeControls ?? (
              <>
                <TerminalChromeButton
                  onClick={onToggleLocale}
                  title={prefs.locale}
                >
                  {prefs.locale === "pt-BR" ? "PT" : "EN"}
                </TerminalChromeButton>
                <TerminalChromeButton
                  onClick={toggleTheme}
                  title={prefs.theme === "light" ? "dark" : "light"}
                >
                  {prefs.theme === "light" ? "\u2600" : "\u263D"}
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
