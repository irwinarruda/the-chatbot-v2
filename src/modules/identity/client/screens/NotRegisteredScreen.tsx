import { Link } from "@tanstack/react-router";
import { TerminalFooter } from "~/shared/client/components/terminal/TerminalFooter";
import { TerminalPageHeader } from "~/shared/client/components/terminal/TerminalPageHeader";
import { TerminalPanel } from "~/shared/client/components/terminal/TerminalPanel";
import { TerminalPanelText } from "~/shared/client/components/terminal/TerminalPanelText";
import { TerminalWindow } from "~/shared/client/components/terminal/TerminalWindow";
import { useDictionary } from "~/shared/client/providers/useDictionary";

export function NotRegisteredScreen() {
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
