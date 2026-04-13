import { createFileRoute, Link } from "@tanstack/react-router";
import { usePrefs } from "~/components/PrefsProvider";
import { getDictionary } from "~/i18n";
import "~/components/pages/PublicPages.css";

export const Route = createFileRoute("/chat/not-registered")({
  component: NotRegisteredRoute,
  head: () => ({
    meta: [{ title: "Not Registered - The Chatbot" }],
  }),
});

function NotRegisteredRoute() {
  const { locale } = usePrefs();
  const dictionary = getDictionary(locale);
  const t = dictionary.chatNotRegisteredPage;
  return (
    <main className="terminal-shell">
      <div className="terminal-window">
        <div className="terminal-chrome fade-in">
          <div className="terminal-dots">
            <span className="terminal-dot terminal-dot--close" />
            <span className="terminal-dot terminal-dot--minimize" />
            <span className="terminal-dot terminal-dot--maximize" />
          </div>
          <span className="terminal-chrome-title">{t.windowTitle}</span>
          <div className="terminal-chrome-actions" />
        </div>
        <div className="terminal-content">
          <header className="terminal-header fade-in-delay-2">
            <h1 className="terminal-heading">{t.heading}</h1>
            <p className="terminal-subtitle">{t.subtitle}</p>
          </header>
          <div className="terminal-panel fade-in-delay-3">
            <p>{t.body}</p>
          </div>
          <div className="terminal-footer fade-in-delay-4">
            <span className="terminal-prompt">$</span>{" "}
            <Link to="/" className="terminal-nav-link">
              {t.backLink}
            </Link>
          </div>
        </div>
      </div>
      <div className="terminal-shadow" aria-hidden="true" />
    </main>
  );
}
