import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { usePrefs } from "~/components/PrefsProvider";
import { ThemeLogo } from "~/components/ThemeLogo";
import type { Dictionary } from "~/i18n";
import "./PublicPages.css";

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
    { label: dictionary.nav.home, href: "/" },
    { label: dictionary.nav.privacy, href: "/privacy" },
  ];

  return (
    <main className="terminal-shell">
      <div className={`terminal-window${wide ? " terminal-window--wide" : ""}`}>
        <div className="terminal-chrome fade-in">
          <div className="terminal-dots">
            <span className="terminal-dot terminal-dot--close" />
            <span className="terminal-dot terminal-dot--minimize" />
            <span className="terminal-dot terminal-dot--maximize" />
          </div>
          <span className="terminal-chrome-title">{title}</span>
          <div className="terminal-chrome-actions">
            <button
              type="button"
              className="terminal-chrome-btn"
              onClick={toggleLocale}
            >
              {locale === "pt-BR" ? "PT" : "EN"}
            </button>
            <button
              type="button"
              className="terminal-chrome-btn"
              onClick={toggleTheme}
            >
              {theme === "light" ? "\u2600" : "\u263D"}
            </button>
          </div>
        </div>
        <div className="terminal-content">
          <nav className="terminal-nav fade-in-delay-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`terminal-nav-link${link.href === activePath ? " terminal-nav-link--active" : ""}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          {children}
        </div>
      </div>
      <div className="terminal-shadow" aria-hidden="true" />
    </main>
  );
}

function Logo() {
  return <ThemeLogo />;
}

export function WelcomePage({ dictionary }: { dictionary: Dictionary }) {
  const t = dictionary.welcomePage;
  return (
    <TerminalWindow
      title={t.windowTitle}
      activePath="/"
      dictionary={dictionary}
    >
      <header className="terminal-header fade-in-delay-2">
        <Logo />
        <h1 className="terminal-heading">{t.heading}</h1>
        <p className="terminal-subtitle">{t.subtitle}</p>
      </header>
      <p className="terminal-desc fade-in-delay-3">
        <strong>{t.heading}</strong> {t.description}
      </p>
      <div className="terminal-features fade-in-delay-3">
        {t.features.map((feature) => (
          <div className="terminal-feature" key={feature.title}>
            <h3 className="terminal-feature-title">{feature.title}</h3>
            <p className="terminal-feature-desc">{feature.description}</p>
          </div>
        ))}
      </div>
      <div className="terminal-footer fade-in-delay-4">
        <span className="terminal-prompt">$</span> {t.footerPrompt}
        <span className="terminal-cursor" />
      </div>
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
      <div className="terminal-prose fade-in-delay-2">
        <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
      </div>
      <div className="terminal-prose-footer fade-in-delay-4">
        &copy; {t.copyright}
      </div>
    </TerminalWindow>
  );
}

export function ThankYouPage({ dictionary }: { dictionary: Dictionary }) {
  const t = dictionary.thankYouPage;
  return (
    <TerminalWindow title={t.windowTitle} dictionary={dictionary}>
      <header className="terminal-header fade-in-delay-2">
        <Logo />
        <h1 className="terminal-heading">{t.heading}</h1>
        <p className="terminal-subtitle">{t.subtitle}</p>
      </header>
      <div className="terminal-panel fade-in-delay-3">
        <p>
          {t.greeting} <strong>TheChatbot</strong>!
        </p>
        <p>{t.body}</p>
      </div>
      <div className="terminal-footer fade-in-delay-4">
        <span className="terminal-prompt">$</span> {t.footerPrompt}
        <span className="terminal-cursor" />
      </div>
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
      <header className="terminal-header fade-in-delay-2">
        <Logo />
        <h1 className="terminal-heading">{t.heading}</h1>
        <p className="terminal-subtitle">{t.subtitle}</p>
        <div className="terminal-badge">
          <span className="terminal-badge-dot" />
          <span>{t.badge}</span>
        </div>
      </header>
      <div className="terminal-panel fade-in-delay-3">
        <p>
          {t.greeting} <strong>TheChatbot</strong>!
        </p>
        <p>{t.body}</p>
      </div>
      <div className="terminal-footer fade-in-delay-4">
        <span className="terminal-prompt">$</span> {t.footerPrompt}
        <span className="terminal-cursor" />
      </div>
    </TerminalWindow>
  );
}

export function NotFoundPage({ dictionary }: { dictionary: Dictionary }) {
  const t = dictionary.notFoundPage;
  return (
    <TerminalWindow title={t.windowTitle} dictionary={dictionary}>
      <header className="terminal-header fade-in-delay-2">
        <Logo />
        <h1 className="terminal-heading">{t.heading}</h1>
        <p className="terminal-subtitle">{t.subtitle}</p>
      </header>
      <div className="terminal-panel fade-in-delay-3">
        <p>{t.body}</p>
      </div>
      <div className="terminal-footer fade-in-delay-4">
        <span className="terminal-prompt">$</span> {t.footerPrompt}
        <span className="terminal-cursor" />
      </div>
    </TerminalWindow>
  );
}
