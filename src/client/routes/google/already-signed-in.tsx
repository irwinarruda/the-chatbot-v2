import { createFileRoute } from "@tanstack/react-router";
import { TerminalFooter } from "~/client/components/TerminalFooter";
import { TerminalPageHeader } from "~/client/components/TerminalPageHeader";
import { TerminalPanel } from "~/client/components/TerminalPanel";
import { TerminalPanelText } from "~/client/components/TerminalPanelText";
import { TerminalPrompt } from "~/client/components/TerminalPrompt";
import { TerminalStatusBadge } from "~/client/components/TerminalStatusBadge";
import { TerminalWindow } from "~/client/components/TerminalWindow";
import { getDictionary, type Locale } from "~/client/i18n";
import { useApp } from "~/client/stores";

export const Route = createFileRoute("/google/already-signed-in")({
  component: AlreadySignedInRoute,
  head: ({ match }) => ({
    meta: [
      {
        title: getDictionary((match.context as { locale?: Locale }).locale).meta
          .connectedTitle,
      },
    ],
  }),
});

function AlreadySignedInRoute() {
  const locale = useApp((state) => state.locale);
  const dictionary = getDictionary(locale);
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
