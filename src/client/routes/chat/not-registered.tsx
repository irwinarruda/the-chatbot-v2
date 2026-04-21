import { createFileRoute, Link } from "@tanstack/react-router";
import { usePrefs } from "~/client/components/PrefsProvider";
import { TerminalFooter } from "~/client/components/TerminalFooter";
import { TerminalPageHeader } from "~/client/components/TerminalPageHeader";
import { TerminalPanel } from "~/client/components/TerminalPanel";
import { TerminalPanelText } from "~/client/components/TerminalPanelText";
import { TerminalWindow } from "~/client/components/TerminalWindow";
import { getDictionary } from "~/client/i18n";

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
    <TerminalWindow
      title={t.windowTitle}
      activePath="/chat"
      dictionary={dictionary}
    >
      <TerminalPageHeader
        heading={t.heading}
        subtitle={t.subtitle}
        withLogo={false}
      />
      <TerminalPanel>
        <TerminalPanelText>{t.body}</TerminalPanelText>
      </TerminalPanel>
      <TerminalFooter>
        <span className="font-semibold text-term-green">$</span>{" "}
        <Link
          to="/"
          className="text-term-blue underline underline-offset-2 transition-colors duration-200 hover:text-term-cyan"
        >
          {t.backLink}
        </Link>
      </TerminalFooter>
    </TerminalWindow>
  );
}
