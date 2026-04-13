import { createFileRoute, Link } from "@tanstack/react-router";
import { usePrefs } from "~/client/components/PrefsProvider";
import {
  Footer,
  PageHeader,
  Panel,
  PanelText,
  TerminalWindow,
} from "~/client/components/pages/PublicPages";
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
      <PageHeader heading={t.heading} subtitle={t.subtitle} withLogo={false} />
      <Panel>
        <PanelText>{t.body}</PanelText>
      </Panel>
      <Footer>
        <span className="font-semibold text-term-green">$</span>{" "}
        <Link
          to="/"
          className="text-term-blue underline underline-offset-2 transition-colors duration-200 hover:text-term-cyan"
        >
          {t.backLink}
        </Link>
      </Footer>
    </TerminalWindow>
  );
}
