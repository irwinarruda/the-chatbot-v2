import { createFileRoute, redirect } from "@tanstack/react-router";
import { usePrefs } from "~/client/components/PrefsProvider";
import {
  Footer,
  PageHeader,
  Panel,
  PanelText,
  Prompt,
  TerminalWindow,
} from "~/client/components/pages/PublicPages";
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
      <PageHeader heading={t.heading} subtitle={t.subtitle} withLogo={false} />
      <Panel>
        <PanelText>{t.body}</PanelText>
        <form method="GET" action="/api/v1/web/auth/login" className="mt-5">
          <Button
            type="submit"
            className="h-11 w-full rounded-md border border-term-border bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            <GoogleIcon />
            <span>{t.loginButton}</span>
          </Button>
        </form>
      </Panel>
      <Footer>
        <Prompt text={t.footerPrompt} />
      </Footer>
    </TerminalWindow>
  );
}

function GoogleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M21.805 12.23c0-.79-.071-1.548-.203-2.273H12v4.303h5.49a4.696 4.696 0 0 1-2.038 3.083v2.559h3.3c1.93-1.778 3.053-4.4 3.053-7.672Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.756 0 5.068-.913 6.758-2.475l-3.3-2.559c-.914.613-2.082.976-3.458.976-2.656 0-4.906-1.793-5.711-4.204H2.879v2.64A9.998 9.998 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.289 13.738A5.997 5.997 0 0 1 5.969 12c0-.604.108-1.189.32-1.738v-2.64H2.879A9.998 9.998 0 0 0 2 12c0 1.614.386 3.14 1.07 4.378l3.219-2.64Z"
        fill="#FBBC05"
      />
      <path
        d="M12 6.058c1.5 0 2.846.516 3.906 1.531l2.93-2.93C17.063 2.998 14.75 2 12 2A9.998 9.998 0 0 0 2.879 7.622l3.41 2.64C7.094 7.85 9.344 6.058 12 6.058Z"
        fill="#EA4335"
      />
    </svg>
  );
}
