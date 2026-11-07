import { Link, useRouter } from "@tanstack/react-router";
import {
  Ellipsis,
  House,
  ListTodo,
  LogOut,
  type LucideIcon,
  Menu,
  MessageSquare,
  Moon,
  NotebookPen,
  PanelsTopLeft,
  ReceiptText,
  Shield,
  Sun,
  SwatchBook,
  Wallet,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import type { Palette, Theme } from "~/client/shared/app/entities/Prefs";
import { Alert, AlertDescription } from "~/client/shared/components/ui/alert";
import { Button } from "~/client/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/client/shared/components/ui/dropdown-menu";
import { cn } from "~/client/shared/components/ui/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/client/shared/components/ui/tooltip";
import { clientErrorMessage } from "~/client/shared/error/ApiError";
import { usePrefs } from "~/client/shared/hooks/usePrefs";
import type { Dictionary } from "~/client/shared/i18n/dictionary";
import { useApp } from "~/client/shared/stores/app";
import { MonetaryPrivacyControl } from "./MonetaryPrivacyControl";
import { TerminalChromeButton } from "./TerminalChromeButton";
import { TerminalResponsiveOverlay } from "./TerminalResponsiveOverlay";

export type AppPath =
  | "/"
  | "/privacy"
  | "/chat"
  | "/todo"
  | "/notes"
  | "/artifacts"
  | "/cash-flow"
  | "/bills";

type AppNavLink = {
  href: AppPath;
  icon: LucideIcon;
  label: string;
};

const AppLayout = {
  page: "page",
  fill: "fill",
} as const;

type AppLayout = ValueOf<typeof AppLayout>;

const Logos: Record<Palette, Record<Theme, string>> = {
  terminal: { dark: "/logo.svg", light: "/logo-light.svg" },
  favo: { dark: "/logo-favo.svg", light: "/logo-favo-light.svg" },
};

function AppBrand() {
  const prefs = usePrefs();
  const src = Logos[prefs.palette][prefs.theme];

  return (
    <Link
      to="/"
      className="flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 font-semibold text-foreground text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <img className="size-6" src={src} alt="" />
      <span>The Chatbot</span>
    </Link>
  );
}

function AppNavTab({
  isActive,
  link,
}: {
  isActive: boolean;
  link: AppNavLink;
}) {
  return (
    <Link
      to={link.href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex h-8 shrink-0 items-center rounded-md px-3 text-muted-foreground text-sm outline-none transition-colors",
        "hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
        "aria-[current=page]:bg-brand/12 aria-[current=page]:font-medium aria-[current=page]:text-primary",
      )}
    >
      {link.label}
    </Link>
  );
}

function AppNavItem({
  isActive,
  link,
  onSelect,
}: {
  isActive: boolean;
  link: AppNavLink;
  onSelect: () => void;
}) {
  const Icon = link.icon;

  return (
    <Link
      to={link.href}
      onClick={onSelect}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-lg px-3 text-foreground text-sm outline-none transition-colors",
        "hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
        "aria-[current=page]:bg-brand/12 aria-[current=page]:font-medium aria-[current=page]:text-primary",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          isActive ? "text-primary" : "text-muted-foreground",
        )}
        aria-hidden="true"
      />
      <span className="truncate">{link.label}</span>
    </Link>
  );
}

export function AppShell({
  activePath,
  children,
  dictionary,
  layout = AppLayout.page,
  showLogout = false,
  showNavigation,
  title,
}: {
  activePath?: AppPath;
  children: ReactNode;
  dictionary?: Pick<Dictionary, "common" | "nav">;
  layout?: AppLayout;
  showLogout?: boolean;
  showNavigation?: boolean;
  title: string;
}) {
  const router = useRouter();
  const prefs = usePrefs();
  const toggleTheme = useApp((state) => state.toggleTheme);
  const togglePalette = useApp((state) => state.togglePalette);
  const toggleLocale = useApp((state) => state.toggleLocale);
  const sessionError = useApp((state) => state.sessionError);
  const logout = useApp((state) => state.logout);
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const sessionErrorMessage = clientErrorMessage(sessionError, {
    logout: dictionary?.common.errorLogout ?? "Could not log out. Try again.",
  });
  const navLinks: AppNavLink[] = dictionary
    ? [
        { label: dictionary.nav.home, href: "/", icon: House },
        { label: dictionary.nav.chat, href: "/chat", icon: MessageSquare },
        { label: dictionary.nav.todo, href: "/todo", icon: ListTodo },
        { label: dictionary.nav.notes, href: "/notes", icon: NotebookPen },
        {
          label: dictionary.nav.artifacts,
          href: "/artifacts",
          icon: PanelsTopLeft,
        },
        { label: dictionary.nav.cashFlow, href: "/cash-flow", icon: Wallet },
        { label: dictionary.nav.bills, href: "/bills", icon: ReceiptText },
      ]
    : [];
  const shouldShowNavigation = (showNavigation ?? true) && dictionary;
  const activeLabel =
    navLinks.find((link) => link.href === activePath)?.label ?? title;
  const closeLabel = dictionary?.common.close ?? title;
  const moreLabel = dictionary?.common.more ?? "More";
  const skipToContentLabel = dictionary?.common.skipToContent ?? title;
  const logoutLabel = dictionary?.common.logout ?? "Log out";
  const openNavigationLabel = dictionary?.common.openNavigation ?? activeLabel;
  const privacyLabel = dictionary?.nav.privacy ?? "Privacy";
  const isFill = layout === AppLayout.fill;
  const themeLabel =
    prefs.theme === "light"
      ? (dictionary?.common.switchToDarkTheme ?? "Use dark theme")
      : (dictionary?.common.switchToLightTheme ?? "Use light theme");
  const paletteLabel =
    prefs.palette === "favo"
      ? (dictionary?.common.switchToTerminalTheme ?? "Use Terminal theme")
      : (dictionary?.common.switchToFavoTheme ?? "Use Favo theme");

  async function onLocaleToggle() {
    await toggleLocale();
    router.invalidate();
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

  async function onLogout() {
    setIsNavigationOpen(false);
    await logout().catch(keepErrorInSession);
  }

  const privacyControl = (
    <MonetaryPrivacyControl
      hideLabel={
        dictionary?.common.hideMonetaryValues ?? "Hide monetary values"
      }
      showLabel={
        dictionary?.common.showMonetaryValues ?? "Show monetary values"
      }
    />
  );

  const localeControl = (
    <TerminalChromeButton onClick={onLocaleToggle} title={prefs.locale}>
      {prefs.locale === "pt-BR" ? "PT" : "EN"}
    </TerminalChromeButton>
  );

  const themeControl = (
    <TerminalChromeButton onClick={toggleTheme} title={themeLabel}>
      {prefs.theme === "light" ? <Sun /> : <Moon />}
    </TerminalChromeButton>
  );

  const paletteControl = (
    <TerminalChromeButton onClick={togglePalette} title={paletteLabel}>
      <SwatchBook />
    </TerminalChromeButton>
  );

  const skipLink = (
    <a
      href="#main-content"
      className="fixed top-3 left-3 z-60 -translate-y-24 rounded-md border border-brand/35 bg-card px-3 py-2 text-primary text-xs shadow-lg transition-transform focus:translate-y-0 motion-reduce:transition-none"
    >
      {skipToContentLabel}
    </a>
  );

  const sessionAlert = sessionErrorMessage && (
    <Alert variant="destructive" className="mb-4">
      <AlertDescription>{sessionErrorMessage}</AlertDescription>
    </Alert>
  );

  if (!shouldShowNavigation) {
    return (
      <>
        {skipLink}
        <div className="min-viewport-height flex flex-col bg-background">
          <header className="flex h-14 items-center justify-between gap-2 px-4 sm:px-6">
            <AppBrand />
            <div className="flex items-center gap-1">
              {privacyControl}
              {localeControl}
              {paletteControl}
              {themeControl}
            </div>
          </header>
          <main
            id="main-content"
            tabIndex={-1}
            className="flex flex-1 flex-col items-center justify-center px-4 pb-16 sm:px-6"
          >
            <div className="w-full max-w-md">
              {sessionAlert}
              {children}
            </div>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      {skipLink}
      <div
        className={cn(
          "flex flex-col bg-desk lg:px-8 lg:py-6",
          isFill ? "viewport-height overflow-hidden" : "min-viewport-height",
        )}
      >
        {!isFill && (
          <div
            aria-hidden="true"
            className="fixed inset-x-0 top-0 z-30 hidden h-6 bg-desk lg:block"
          />
        )}
        <div
          className={cn(
            "mx-auto flex w-full max-w-5xl flex-1 flex-col lg:rounded-xl lg:shadow-scrim/10 lg:shadow-xl",
            isFill && "min-h-0",
          )}
        >
          <header
            className={cn(
              "z-30 shrink-0 bg-desk",
              !isFill && "sticky top-0 lg:top-6",
            )}
          >
            <div className="flex h-14 items-center gap-1 border-border border-b bg-card px-2 lg:h-12 lg:rounded-t-xl lg:border lg:px-2.5">
              <Button
                type="button"
                variant="ghost"
                onClick={onNavigationOpen}
                aria-expanded={isNavigationOpen}
                aria-haspopup="dialog"
                aria-label={openNavigationLabel}
                className="min-h-11 min-w-0 justify-start gap-2.5 px-2.5 font-semibold text-foreground text-sm lg:hidden"
              >
                <Menu className="size-5 text-muted-foreground" />
                <span className="truncate">{activeLabel}</span>
              </Button>
              <div className="hidden lg:flex">
                <AppBrand />
              </div>
              <nav
                aria-label={title}
                className="ml-3 hidden min-w-0 items-center gap-0.5 lg:flex"
              >
                {navLinks.map((link) => (
                  <AppNavTab
                    key={link.href}
                    link={link}
                    isActive={link.href === activePath}
                  />
                ))}
              </nav>
              <div className="ml-auto flex shrink-0 items-center gap-0.5">
                {privacyControl}
                <div className="hidden lg:flex">
                  {localeControl}
                  {paletteControl}
                </div>
                {themeControl}
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <DropdownMenuTrigger
                          render={
                            <Button
                              aria-label={moreLabel}
                              className="hidden text-muted-foreground hover:bg-muted hover:text-foreground lg:inline-flex"
                              size="icon-sm"
                              type="button"
                              variant="ghost"
                            />
                          }
                        />
                      }
                    >
                      <Ellipsis />
                    </TooltipTrigger>
                    <TooltipContent>{moreLabel}</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem render={<Link to="/privacy" />}>
                      <Shield />
                      {privacyLabel}
                    </DropdownMenuItem>
                    {showLogout && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={onLogout}
                          variant="destructive"
                        >
                          <LogOut />
                          {logoutLabel}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>
          <main
            id="main-content"
            tabIndex={-1}
            className={cn(
              "flex min-w-0 flex-1 flex-col bg-background outline-none lg:rounded-b-xl lg:border-border lg:border-x lg:border-b",
              isFill && "min-h-0 overflow-hidden",
            )}
          >
            {isFill ? (
              <div className="flex min-h-0 flex-1 flex-col">
                {sessionAlert}
                {children}
              </div>
            ) : (
              <div className="flex w-full flex-1 flex-col px-4 pt-6 pb-12 sm:px-8 lg:pt-8">
                {sessionAlert}
                {children}
              </div>
            )}
          </main>
        </div>
        <TerminalResponsiveOverlay
          open={isNavigationOpen}
          onOpenChange={onNavigationChange}
          closeLabel={closeLabel}
          title={<AppBrand />}
          description={openNavigationLabel}
          contentClassName="border-border bg-card"
          bodyClassName="pt-2"
          descriptionClassName="sr-only"
          headerClassName="items-center"
        >
          <nav aria-label={title} className="flex flex-col gap-0.5">
            {navLinks.map((link) => (
              <AppNavItem
                key={link.href}
                link={link}
                isActive={link.href === activePath}
                onSelect={onNavigationSelect}
              />
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-0.5 border-border border-t pt-3">
            <Link
              to="/privacy"
              onClick={onNavigationSelect}
              aria-current={activePath === "/privacy" ? "page" : undefined}
              className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-muted-foreground text-sm outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:text-foreground"
            >
              <Shield className="size-4" aria-hidden="true" />
              {privacyLabel}
            </Link>
            {showLogout && (
              <Button
                type="button"
                onClick={onLogout}
                variant="ghost"
                className="min-h-11 w-full justify-start gap-3 rounded-lg px-3 font-normal text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="size-4" />
                {logoutLabel}
              </Button>
            )}
            <div className="mt-2 flex items-center gap-1 px-1">
              {privacyControl}
              {localeControl}
              {paletteControl}
              {themeControl}
            </div>
          </div>
        </TerminalResponsiveOverlay>
      </div>
    </>
  );
}

function keepErrorInSession() {}
