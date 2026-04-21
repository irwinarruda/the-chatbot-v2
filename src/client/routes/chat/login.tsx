import { createFileRoute, redirect } from "@tanstack/react-router";
import { GoogleIcon } from "~/client/components/GoogleIcon";
import { usePrefs } from "~/client/components/PrefsProvider";
import { TerminalFooter } from "~/client/components/TerminalFooter";
import { TerminalPageHeader } from "~/client/components/TerminalPageHeader";
import { TerminalPanel } from "~/client/components/TerminalPanel";
import { TerminalPanelText } from "~/client/components/TerminalPanelText";
import { TerminalPrompt } from "~/client/components/TerminalPrompt";
import { TerminalWindow } from "~/client/components/TerminalWindow";
import { Button } from "~/client/components/ui/button";
import { getDictionary } from "~/client/i18n";
import { requireChatAccess } from "~/server/tanstack/functions/require-chat-access";

export const Route = createFileRoute("/chat/login")({
  beforeLoad: async () => {
    const authResult = await requireChatAccess();
    if (authResult.ok) {
      throw redirect({ to: "/chat" });
    }
  },
  component: ChatLoginRoute,
  head: () => ({
    meta: [{ title: "Chat Login - The Chatbot" }],
  }),
});

function ChatLoginRoute() {
  const { locale } = usePrefs();
  const dictionary = getDictionary(locale);
  const t = dictionary.chatLoginPage;

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
        <form method="GET" action="/api/v1/web/auth/login" className="mt-5">
          <Button
            type="submit"
            className="h-11 w-full rounded-md border border-term-border bg-white px-4 font-semibold text-slate-900 text-sm hover:bg-slate-100"
          >
            <GoogleIcon className="size-4" />
            <span>{t.loginButton}</span>
          </Button>
        </form>
      </TerminalPanel>
      <TerminalFooter>
        <TerminalPrompt text={t.footerPrompt} />
      </TerminalFooter>
    </TerminalWindow>
  );
}
