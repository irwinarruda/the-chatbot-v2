import { TerminalFooter } from "~/client/shared/components/terminal/TerminalFooter";
import { TerminalPageHeader } from "~/client/shared/components/terminal/TerminalPageHeader";
import { TerminalPanel } from "~/client/shared/components/terminal/TerminalPanel";
import { TerminalPanelText } from "~/client/shared/components/terminal/TerminalPanelText";
import { TerminalPrompt } from "~/client/shared/components/terminal/TerminalPrompt";
import { TerminalStatusBadge } from "~/client/shared/components/terminal/TerminalStatusBadge";
import { TerminalWindow } from "~/client/shared/components/terminal/TerminalWindow";
import { useDictionary } from "~/client/shared/hooks/useDictionary";

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
