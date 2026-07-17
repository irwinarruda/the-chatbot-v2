import { TerminalFooter } from "~/shared/client/components/terminal/TerminalFooter";
import { TerminalPageHeader } from "~/shared/client/components/terminal/TerminalPageHeader";
import { TerminalPanel } from "~/shared/client/components/terminal/TerminalPanel";
import { TerminalPanelText } from "~/shared/client/components/terminal/TerminalPanelText";
import { TerminalPrompt } from "~/shared/client/components/terminal/TerminalPrompt";
import { TerminalWindow } from "~/shared/client/components/terminal/TerminalWindow";
import { useDictionary } from "~/shared/client/providers/useDictionary";

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
