import { Link, useRouter } from "@tanstack/react-router";
import { MenuIcon, Moon, Sun } from "lucide-react";
import { type ReactNode, useState } from "react";
import { TerminalChromeButton } from "~/shared/client/components/terminal/TerminalChromeButton";
import { TerminalResponsiveOverlay } from "~/shared/client/components/terminal/TerminalResponsiveOverlay";
import { Button } from "~/shared/client/components/ui/button";
import { cn } from "~/shared/client/components/ui/lib";
import type { Dictionary } from "~/shared/client/i18n";
import { usePrefs } from "~/shared/client/providers/usePrefs";
import { useApp } from "~/shared/client/stores";

type TerminalPath = "/" | "/privacy" | "/chat" | "/todo" | "/bills";

type TerminalNavLink = {
  href: TerminalPath;
  label: string;
};

function getNavigationLinkClassName(isActive: boolean, mobile = false) {
  if (mobile) {
    if (isActive) {
      return "w-full justify-between border-term-green/25 bg-term-green/8 text-term-green hover:bg-term-green/12 hover:text-term-green";
    }
    return "w-full justify-between border-transparent text-term-text hover:border-term-border hover:bg-term-chrome hover:text-term-bright";
  }
  if (isActive) {
    return "bg-term-green/8 font-medium text-term-green hover:bg-term-green/12 hover:text-term-green";
  }
  return "text-term-muted hover:bg-term-chrome/70 hover:text-term-bright";
}

function TerminalWindowDot({
  colorClassName,
  label,
  onClick,
}: {
  colorClassName: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "h-3 w-3 shrink-0 rounded-full transition-opacity hover:opacity-80",
        colorClassName,
      )}
    />
  );
}

export function TerminalWindow({
  activePath,
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
  dictionary?: Pick<Dictionary, "common" | "nav">;
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
  const toggleTheme = useApp((state) => state.toggleTheme);
  const toggleLocale = useApp((state) => state.toggleLocale);
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const navLinks: TerminalNavLink[] = dictionary
    ? [
        { label: dictionary.nav.home, href: "/" },
        { label: dictionary.nav.privacy, href: "/privacy" },
        { label: dictionary.nav.chat, href: "/chat" },
        { label: dictionary.nav.todo, href: "/todo" },
        { label: dictionary.nav.bills, href: "/bills" },
      ]
    : [];
  const shouldShowNavigation = showNavigation ?? dictionary !== undefined;
  const activeLabel =
    navLinks.find((link) => link.href === activePath)?.label ?? title;
  const closeLabel = dictionary?.common.close ?? title;
  const homeLabel = dictionary?.nav.home ?? "/";
  const skipToContentLabel = dictionary?.common.skipToContent ?? title;
  const themeLabel =
    prefs.theme === "light"
      ? (dictionary?.common.switchToDarkTheme ?? "dark")
      : (dictionary?.common.switchToLightTheme ?? "light");

  async function onToggleLocale() {
    await toggleLocale();
    router.invalidate();
  }

  function onGoHome() {
    router.navigate({ to: "/" });
  }

  function onNavigationOpen() {
    setIsNavigationOpen(true);
  }

  function onNavigationChange(open: boolean) {
    setIsNavigationOpen(open);
  }

  function onNavigationSelect() {
    setIsNavigationOpen(false);
  }

  return (
    <>
      <a
        href="#main-content"
        className="fixed top-3 left-3 z-60 -translate-y-24 rounded-md border border-term-green/35 bg-term-window px-3 py-2 font-mono text-term-green text-xs shadow-lg transition-transform focus:translate-y-0 motion-reduce:transition-none"
      >
        <span aria-hidden="true">$ </span>
        {skipToContentLabel}
      </a>
      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          "min-viewport-height flex w-full items-start justify-center overflow-x-clip bg-term-bg p-0 sm:p-6 md:p-10",
          mainClassName,
        )}
      >
        <div
          className={cn(
            "flex min-h-dvh w-full flex-col sm:min-h-0",
            wide ? "max-w-4xl" : "max-w-xl",
            frameClassName,
          )}
        >
          <div className="flex min-h-12 items-center gap-2 border-term-border/70 border-b bg-term-chrome/90 px-[max(0.75rem,env(safe-area-inset-left))] pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))] pb-2 backdrop-blur-sm sm:min-h-0 sm:gap-3 sm:rounded-t-xl sm:border sm:px-4 sm:py-2">
            <div className="pointer-fine:flex hidden shrink-0 items-center gap-2">
              <TerminalWindowDot
                colorClassName="bg-term-red"
                label={homeLabel}
                onClick={onGoHome}
              />
              <TerminalWindowDot
                colorClassName="bg-term-yellow"
                label={homeLabel}
                onClick={onGoHome}
              />
              <TerminalWindowDot
                colorClassName="bg-term-green-dot"
                label={homeLabel}
                onClick={onGoHome}
              />
            </div>
            <span className="mx-auto min-w-0 select-none truncate px-2 font-mono text-term-muted text-xs tracking-wide">
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
                    title={themeLabel}
                  >
                    {prefs.theme === "light" ? (
                      <Sun className="size-3" />
                    ) : (
                      <Moon className="size-3" />
                    )}
                  </TerminalChromeButton>
                </>
              )}
            </div>
          </div>

          <div
            className={cn(
              "flex flex-1 flex-col bg-term-window px-[max(1.5rem,env(safe-area-inset-left))] pt-6 pr-[max(1.5rem,env(safe-area-inset-right))] pb-[max(1.5rem,env(safe-area-inset-bottom))]",
              "sm:rounded-b-xl sm:border sm:border-term-border sm:border-t-0 sm:p-9",
              "sm:shadow-black/15 sm:shadow-xl md:p-10",
              windowClassName,
            )}
          >
            {shouldShowNavigation && dictionary && (
              <>
                <div className="mb-6 sm:hidden">
                  <Button
                    type="button"
                    onClick={onNavigationOpen}
                    aria-expanded={isNavigationOpen}
                    aria-haspopup="dialog"
                    variant="outline"
                    className="w-full justify-between border-term-border bg-term-chrome/35 font-mono text-term-text hover:bg-term-chrome hover:text-term-bright"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <MenuIcon className="size-4 text-term-green" />
                      <span className="truncate">{activeLabel}</span>
                    </span>
                    <span aria-hidden="true" className="text-term-muted">
                      /
                    </span>
                  </Button>
                </div>
                <nav
                  aria-label={title}
                  className="mb-7 hidden items-center gap-1 sm:flex"
                >
                  {navLinks.map((link) => {
                    const isActive = link.href === activePath;
                    return (
                      <Button
                        key={link.href}
                        nativeButton={false}
                        render={
                          <Link
                            to={link.href}
                            aria-current={isActive ? "page" : undefined}
                          />
                        }
                        size="xs"
                        variant="ghost"
                        className={cn(
                          "font-mono text-xs",
                          getNavigationLinkClassName(isActive),
                        )}
                      >
                        <span aria-hidden="true" className="text-term-green/70">
                          /
                        </span>
                        {link.label}
                      </Button>
                    );
                  })}
                </nav>
                <TerminalResponsiveOverlay
                  open={isNavigationOpen}
                  onOpenChange={onNavigationChange}
                  closeLabel={closeLabel}
                  title={activeLabel}
                  description={title}
                  contentClassName="border-term-border bg-term-window"
                  bodyClassName="pt-3"
                >
                  <nav aria-label={title} className="grid gap-1.5">
                    {navLinks.map((link) => {
                      const isActive = link.href === activePath;
                      return (
                        <Button
                          key={link.href}
                          nativeButton={false}
                          render={
                            <Link
                              to={link.href}
                              onClick={onNavigationSelect}
                              aria-current={isActive ? "page" : undefined}
                            />
                          }
                          variant="outline"
                          className={cn(
                            "font-mono",
                            getNavigationLinkClassName(isActive, true),
                          )}
                        >
                          <span>{link.label}</span>
                          <span aria-hidden="true" className="text-term-muted">
                            /
                          </span>
                        </Button>
                      );
                    })}
                  </nav>
                </TerminalResponsiveOverlay>
              </>
            )}

            {children}
          </div>

          {showShadow && (
            <div
              className="mx-4 hidden h-2 rounded-b-xl bg-black/20 blur-sm sm:block"
              aria-hidden="true"
            />
          )}
        </div>
      </main>
    </>
  );
}
