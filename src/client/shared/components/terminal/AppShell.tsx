import { Link, useRouter } from "@tanstack/react-router";
import {
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
  Wallet,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { Alert, AlertDescription } from "~/client/shared/components/ui/alert";
import { Button } from "~/client/shared/components/ui/button";
import { cn } from "~/client/shared/components/ui/lib/utils";
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

type AppLayout = (typeof AppLayout)[keyof typeof AppLayout];

function AppBrand() {
  const prefs = usePrefs();
  const src = prefs.theme === "dark" ? "/logo.svg" : "/logo-light.svg";

  return (
    <Link
      to="/"
      className="flex items-center gap-2 rounded-md px-2 py-1.5 font-semibold text-foreground text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <img className="size-6" src={src} alt="" />
      <span>The Chatbot</span>
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
  onSelect?: () => void;
}) {
  const Icon = link.icon;

  return (
    <Link
      to={link.href}
      onClick={onSelect}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-2.5 rounded-md px-2.5 text-muted-foreground text-sm outline-none transition-colors pointer-fine:min-h-8",
        "hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
        "aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-foreground",
      )}
    >
      <Icon
        className={cn("size-4 shrink-0", isActive && "text-primary")}
        aria-hidden="true"
      />
      <span className="truncate">{link.label}</span>
    </Link>
  );
}

export function AppShell({
  activePath,
  chromeControls,
  children,
  contentClassName,
  dictionary,
  layout = AppLayout.page,
  showLogout = false,
  showNavigation,
  title,
  wide = false,
}: {
  activePath?: AppPath;
  chromeControls?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  dictionary?: Pick<Dictionary, "common" | "nav">;
  layout?: AppLayout;
  showLogout?: boolean;
  showNavigation?: boolean;
  title: string;
  wide?: boolean;
}) {
  const router = useRouter();
  const prefs = usePrefs();
  const toggleTheme = useApp((state) => state.toggleTheme);
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
  const skipToContentLabel = dictionary?.common.skipToContent ?? title;
  const logoutLabel = dictionary?.common.logout ?? "Log out";
  const openNavigationLabel = dictionary?.common.openNavigation ?? activeLabel;
  const privacyLabel = dictionary?.nav.privacy ?? "Privacy";
  const isFill = layout === AppLayout.fill;
  const themeLabel =
    prefs.theme === "light"
      ? (dictionary?.common.switchToDarkTheme ?? "Use dark theme")
      : (dictionary?.common.switchToLightTheme ?? "Use light theme");

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

  const preferenceControls = (
    <>
      <MonetaryPrivacyControl
        hideLabel={
          dictionary?.common.hideMonetaryValues ?? "Hide monetary values"
        }
        showLabel={
          dictionary?.common.showMonetaryValues ?? "Show monetary values"
        }
      />
      <TerminalChromeButton onClick={onLocaleToggle} title={prefs.locale}>
        {prefs.locale === "pt-BR" ? "PT" : "EN"}
      </TerminalChromeButton>
      <TerminalChromeButton onClick={toggleTheme} title={themeLabel}>
        {prefs.theme === "light" ? <Sun /> : <Moon />}
      </TerminalChromeButton>
    </>
  );

  const logoutControl = showLogout && (
    <Button
      type="button"
      onClick={onLogout}
      variant="ghost"
      size="sm"
      className="w-full justify-start gap-2.5 px-2.5 font-normal text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
    >
      <LogOut className="size-4" />
      {logoutLabel}
    </Button>
  );

  const privacyLink = (
    <Link
      to="/privacy"
      onClick={onNavigationSelect}
      aria-current={activePath === "/privacy" ? "page" : undefined}
      className="flex min-h-11 items-center gap-2.5 rounded-md px-2.5 text-muted-foreground text-sm outline-none hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:text-foreground pointer-fine:min-h-8"
    >
      <Shield className="size-4" aria-hidden="true" />
      {privacyLabel}
    </Link>
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
              {chromeControls}
              {preferenceControls}
            </div>
          </header>
          <main
            id="main-content"
            tabIndex={-1}
            className={cn(
              "flex flex-1 flex-col items-center justify-center px-4 pb-16 sm:px-6",
              contentClassName,
            )}
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
          "flex flex-col bg-background lg:flex-row",
          isFill ? "viewport-height overflow-hidden" : "min-viewport-height",
        )}
      >
        <aside className="viewport-height sticky top-0 hidden w-60 shrink-0 flex-col gap-4 border-sidebar-border border-r bg-sidebar px-3 py-3 lg:flex">
          <AppBrand />
          <nav aria-label={title} className="flex flex-col gap-0.5">
            {navLinks.map((link) => (
              <AppNavItem
                key={link.href}
                link={link}
                isActive={link.href === activePath}
              />
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-0.5">
            {privacyLink}
            {logoutControl}
            <div className="mt-2 flex items-center gap-1 border-sidebar-border border-t px-1 pt-3">
              {chromeControls}
              {preferenceControls}
            </div>
          </div>
        </aside>
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-border border-b bg-background/95 px-2 backdrop-blur-sm lg:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onNavigationOpen}
            aria-expanded={isNavigationOpen}
            aria-haspopup="dialog"
            aria-label={openNavigationLabel}
          >
            <Menu className="size-5" />
          </Button>
          <span className="min-w-0 flex-1 truncate font-semibold text-foreground text-sm">
            {activeLabel}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {chromeControls}
            <TerminalChromeButton onClick={toggleTheme} title={themeLabel}>
              {prefs.theme === "light" ? <Sun /> : <Moon />}
            </TerminalChromeButton>
          </div>
        </header>
        <TerminalResponsiveOverlay
          open={isNavigationOpen}
          onOpenChange={onNavigationChange}
          closeLabel={closeLabel}
          title={<AppBrand />}
          description={openNavigationLabel}
          contentClassName="border-border bg-sidebar"
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
            {privacyLink}
            {logoutControl}
            <div className="mt-2 flex items-center gap-1 px-1">
              {preferenceControls}
            </div>
          </div>
        </TerminalResponsiveOverlay>
        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            "flex min-w-0 flex-1 flex-col outline-none",
            isFill && "min-h-0",
          )}
        >
          {isFill ? (
            <div
              className={cn("flex min-h-0 flex-1 flex-col", contentClassName)}
            >
              {sessionAlert}
              {children}
            </div>
          ) : (
            <div
              className={cn(
                "mx-auto flex w-full flex-1 flex-col px-4 pt-6 pb-12 sm:px-8 lg:pt-10",
                wide ? "max-w-4xl" : "max-w-2xl",
                contentClassName,
              )}
            >
              {sessionAlert}
              {children}
            </div>
          )}
        </main>
      </div>
    </>
  );
}

function keepErrorInSession() {}
