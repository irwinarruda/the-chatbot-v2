import { TerminalFooter } from "~/client/shared/components/terminal/TerminalFooter";
import { TerminalPageHeader } from "~/client/shared/components/terminal/TerminalPageHeader";
import { TerminalPanel } from "~/client/shared/components/terminal/TerminalPanel";
import { TerminalPanelText } from "~/client/shared/components/terminal/TerminalPanelText";
import { TerminalPrompt } from "~/client/shared/components/terminal/TerminalPrompt";
import { TerminalWindow } from "~/client/shared/components/terminal/TerminalWindow";
import { useDictionary } from "~/client/shared/hooks/useDictionary";

export function ThankYouScreen() {
  const dictionary = useDictionary();
  const t = dictionary.thankYouPage;

  return (
    <TerminalWindow title={t.windowTitle} dictionary={dictionary}>
      <TerminalPageHeader heading={t.heading} subtitle={t.subtitle} />
      <TerminalPanel centered>
        <TerminalPanelText>
          {t.greeting} <strong>TheChatbot</strong>!
        </TerminalPanelText>
        <TerminalPanelText>{t.body}</TerminalPanelText>
      </TerminalPanel>
      <TerminalFooter className="mt-auto pt-6">
        <TerminalPrompt text={t.footerPrompt} />
      </TerminalFooter>
    </TerminalWindow>
  );
}
