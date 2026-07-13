import { TerminalFooter } from "~/shared/client/components/terminal/TerminalFooter";
import { TerminalPageHeader } from "~/shared/client/components/terminal/TerminalPageHeader";
import { TerminalPanel } from "~/shared/client/components/terminal/TerminalPanel";
import { TerminalPanelText } from "~/shared/client/components/terminal/TerminalPanelText";
import { TerminalPrompt } from "~/shared/client/components/terminal/TerminalPrompt";
import { TerminalStatusBadge } from "~/shared/client/components/terminal/TerminalStatusBadge";
import { TerminalWindow } from "~/shared/client/components/terminal/TerminalWindow";
import { useDictionary } from "~/shared/client/providers/useDictionary";

export function AlreadySignedInScreen() {
  const dictionary = useDictionary();
  const t = dictionary.alreadySignedInPage;
  return (
    <TerminalWindow title={t.windowTitle} dictionary={dictionary}>
      <TerminalPageHeader
        heading={t.heading}
        subtitle={t.subtitle}
        badge={<TerminalStatusBadge label={t.badge} />}
      />
      <TerminalPanel>
        <TerminalPanelText>
          {t.greeting} <strong>TheChatbot</strong>!
        </TerminalPanelText>
        <TerminalPanelText>{t.body}</TerminalPanelText>
      </TerminalPanel>
      <TerminalFooter>
        <TerminalPrompt text={t.footerPrompt} />
      </TerminalFooter>
    </TerminalWindow>
  );
}
