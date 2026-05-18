import { createFileRoute, Link } from "@tanstack/react-router";
import { TerminalFooter } from "~/client/components/TerminalFooter";
import { TerminalPageHeader } from "~/client/components/TerminalPageHeader";
import { TerminalPanel } from "~/client/components/TerminalPanel";
import { TerminalPanelText } from "~/client/components/TerminalPanelText";
import { TerminalWindow } from "~/client/components/TerminalWindow";
import { useDictionary } from "~/client/providers/useDictionary";

export const Route = createFileRoute("/chat/not-registered")({
  component: NotRegisteredRoute,
  head: () => ({
    meta: [{ title: "Not Registered - The Chatbot" }],
  }),
});

function NotRegisteredRoute() {
  const dictionary = useDictionary();
  const t = dictionary.chatNotRegisteredPage;
  return (
    <TerminalWindow
      title={t.windowTitle}
      activePath="/chat"
      dictionary={dictionary}
      mainClassName="items-stretch sm:items-start"
      windowClassName="flex flex-col"
    >
      <TerminalPageHeader
        heading={t.heading}
        subtitle={t.subtitle}
        withLogo={false}
      />
      <TerminalPanel>
        <TerminalPanelText>{t.body}</TerminalPanelText>
      </TerminalPanel>
      <TerminalFooter className="mt-auto pt-6 sm:mt-0">
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
