import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { usePrefs } from "~/client/components/PrefsProvider";
import { ThemeLogo } from "~/client/components/ThemeLogo";
import { Badge } from "~/client/components/ui/badge";
import { Button } from "~/client/components/ui/button";
import { Card, CardContent } from "~/client/components/ui/card";
import { Separator } from "~/client/components/ui/separator";
import type { Dictionary } from "~/client/i18n";

/* -------------------------------------------------------------------------- */
/*  TerminalWindow — shared shell with mac-style chrome bar                    */
/* -------------------------------------------------------------------------- */

function TerminalWindow({
  children,
  title,
  wide = false,
  activePath = "/",
  dictionary,
}: {
  children: ReactNode;
  title: string;
  wide?: boolean;
  activePath?: string;
  dictionary: Dictionary;
}) {
  const { theme, locale, toggleTheme, toggleLocale } = usePrefs();

  const navLinks = [
    { label: dictionary.nav.home, href: "/" as const },
    { label: dictionary.nav.privacy, href: "/privacy" as const },
    { label: dictionary.nav.chat, href: "/chat" as const },
  ];

  const widthClass = wide ? "max-w-4xl" : "max-w-xl";

  return (
    <main className="flex min-h-dvh items-start justify-center bg-term-bg p-0 sm:p-6 md:p-10">
      <div className={`flex w-full ${widthClass} flex-col`}>
        {/* Title bar */}
        <div className="motion-safe:fade-in flex items-center gap-3 border-b-0 bg-term-chrome px-3 py-2 sm:rounded-t-xl sm:border sm:border-term-border sm:px-4">
          <div className="flex shrink-0 gap-2" aria-hidden="true">
            <span className="h-3 w-3 rounded-full bg-term-red" />
            <span className="h-3 w-3 rounded-full bg-term-yellow" />
            <span className="h-3 w-3 rounded-full bg-term-green-dot" />
          </div>
          <span className="mx-auto min-w-0 select-none truncate px-2 text-xs tracking-wide text-term-muted">
            {title}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <ChromeButton onClick={toggleLocale} title={locale}>
              {locale === "pt-BR" ? "PT" : "EN"}
            </ChromeButton>
            <ChromeButton
              onClick={toggleTheme}
              title={theme === "light" ? "dark" : "light"}
            >
              {theme === "light" ? "\u2600" : "\u263D"}
            </ChromeButton>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 bg-term-window p-6 sm:rounded-b-xl sm:border sm:border-term-border sm:border-t-0 sm:shadow-2xl sm:shadow-black/10 sm:p-9 md:p-10">
          {/* Nav */}
          <nav className="motion-safe:fade-in-delay-1 mb-7 flex flex-wrap items-center gap-x-6 gap-y-1 text-base">
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

          {children}
        </div>

        {/* Soft drop shadow */}
        <div
          className="mx-4 hidden h-2 rounded-b-xl bg-black/20 blur-sm sm:block"
          aria-hidden="true"
        />
      </div>
    </main>
  );
}

function ChromeButton({
  children,
  onClick,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      title={title}
      variant="ghost"
      size="xs"
      className="min-h-6 rounded border border-transparent px-1.5 py-0.5 text-[0.6875rem] leading-none text-term-muted hover:border-term-border hover:bg-term-bg hover:text-term-bright"
    >
      {children}
    </Button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Reusable helpers                                                            */
/* -------------------------------------------------------------------------- */

function PageHeader({
  heading,
  subtitle,
  withLogo = true,
  badge,
}: {
  heading: string;
  subtitle?: string;
  withLogo?: boolean;
  badge?: ReactNode;
}) {
  return (
    <header className="motion-safe:fade-in-delay-2 mb-6 text-center">
      {withLogo && <ThemeLogo />}
      <h1 className="m-0 mb-1.5 font-bold text-2xl tracking-tight text-term-green sm:text-3xl">
        {heading}
      </h1>
      {subtitle && <p className="m-0 text-sm text-term-muted">{subtitle}</p>}
      {badge}
    </header>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <Card className="motion-safe:fade-in-delay-3 mb-6 border border-term-border bg-term-bg/70 shadow-none">
      <CardContent className="space-y-3 p-5">{children}</CardContent>
    </Card>
  );
}

function PanelText({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 text-sm leading-relaxed text-term-text [&_strong]:font-semibold [&_strong]:text-term-bright">
      {children}
    </p>
  );
}

function Footer({ children }: { children: ReactNode }) {
  return (
    <div className="motion-safe:fade-in-delay-4 text-[0.8125rem] text-term-muted">
      <Separator className="mb-5 bg-term-border" />
      {children}
    </div>
  );
}

function Prompt({ text }: { text: string }) {
  return (
    <>
      <span className="font-semibold text-term-green">$</span> {text}
      <span className="terminal-cursor" />
    </>
  );
}

function StatusBadge({ label }: { label: string }) {
  return (
    <Badge
      variant="secondary"
      className="mt-4 h-auto gap-2 rounded-md border border-term-green/25 bg-term-green/10 px-3.5 py-1.5 text-[0.8125rem] font-medium text-term-green hover:bg-term-green/10"
    >
      <span className="motion-safe:animate-glow-pulse h-1.5 w-1.5 rounded-full bg-term-green" />
      <span>{label}</span>
    </Badge>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pages                                                                       */
/* -------------------------------------------------------------------------- */

export function WelcomePage({ dictionary }: { dictionary: Dictionary }) {
  const t = dictionary.welcomePage;
  return (
    <TerminalWindow
      title={t.windowTitle}
      activePath="/"
      dictionary={dictionary}
    >
      <PageHeader heading={t.heading} subtitle={t.subtitle} />

      <p className="motion-safe:fade-in-delay-3 mb-6 text-sm leading-relaxed text-term-text">
        <strong className="font-semibold text-term-bright">{t.heading}</strong>{" "}
        {t.description}
      </p>

      <ul className="motion-safe:fade-in-delay-3 mb-6 space-y-1">
        {t.features.map((feature) => (
          <li
            key={feature.title}
            className="relative py-2.5 pl-6 before:absolute before:left-1 before:font-semibold before:font-mono before:text-term-green before:content-['>']"
          >
            <h3 className="m-0 mb-0.5 text-[0.9375rem] font-medium text-term-bright">
              {feature.title}
            </h3>
            <p className="m-0 text-sm leading-relaxed text-term-text">
              {feature.description}
            </p>
          </li>
        ))}
      </ul>

      <Footer>
        <Prompt text={t.footerPrompt} />
      </Footer>
    </TerminalWindow>
  );
}

export function PrivacyPolicyPage({
  dictionary,
  contentHtml,
}: {
  dictionary: Dictionary;
  contentHtml: string;
}) {
  const t = dictionary.privacyPage;
  return (
    <TerminalWindow
      title={t.windowTitle}
      wide
      activePath="/privacy"
      dictionary={dictionary}
    >
      <div className="motion-safe:fade-in-delay-2 terminal-prose">
        <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
      </div>
      <div className="motion-safe:fade-in-delay-4 mt-8 border-t border-term-border pt-5 text-[0.8125rem] text-term-muted">
        &copy; {t.copyright}
      </div>
    </TerminalWindow>
  );
}

export function ThankYouPage({ dictionary }: { dictionary: Dictionary }) {
  const t = dictionary.thankYouPage;
  return (
    <TerminalWindow title={t.windowTitle} dictionary={dictionary}>
      <PageHeader heading={t.heading} subtitle={t.subtitle} />
      <Panel>
        <PanelText>
          {t.greeting} <strong>TheChatbot</strong>!
        </PanelText>
        <PanelText>{t.body}</PanelText>
      </Panel>
      <Footer>
        <Prompt text={t.footerPrompt} />
      </Footer>
    </TerminalWindow>
  );
}

export function AlreadySignedInPage({
  dictionary,
}: {
  dictionary: Dictionary;
}) {
  const t = dictionary.alreadySignedInPage;
  return (
    <TerminalWindow title={t.windowTitle} dictionary={dictionary}>
      <PageHeader
        heading={t.heading}
        subtitle={t.subtitle}
        badge={<StatusBadge label={t.badge} />}
      />
      <Panel>
        <PanelText>
          {t.greeting} <strong>TheChatbot</strong>!
        </PanelText>
        <PanelText>{t.body}</PanelText>
      </Panel>
      <Footer>
        <Prompt text={t.footerPrompt} />
      </Footer>
    </TerminalWindow>
  );
}

export function NotFoundPage({ dictionary }: { dictionary: Dictionary }) {
  const t = dictionary.notFoundPage;
  return (
    <TerminalWindow title={t.windowTitle} dictionary={dictionary}>
      <PageHeader heading={t.heading} subtitle={t.subtitle} />
      <Panel>
        <PanelText>{t.body}</PanelText>
      </Panel>
      <Footer>
        <Prompt text={t.footerPrompt} />
      </Footer>
    </TerminalWindow>
  );
}

/* -------------------------------------------------------------------------- */
/*  Exported building blocks (re-used by /chat/not-registered route)            */
/* -------------------------------------------------------------------------- */

export { Footer, PageHeader, Panel, PanelText, Prompt, TerminalWindow };
