import { GoogleIcon } from "~/modules/identity/client/components/GoogleIcon";
import { TerminalFooter } from "~/shared/client/components/terminal/TerminalFooter";
import { TerminalPageHeader } from "~/shared/client/components/terminal/TerminalPageHeader";
import { TerminalPanel } from "~/shared/client/components/terminal/TerminalPanel";
import { TerminalPanelText } from "~/shared/client/components/terminal/TerminalPanelText";
import { TerminalPrompt } from "~/shared/client/components/terminal/TerminalPrompt";
import { TerminalWindow } from "~/shared/client/components/terminal/TerminalWindow";
import { Button } from "~/shared/client/components/ui/button";
import { useDictionary } from "~/shared/client/providers/useDictionary";

export function LoginScreen() {
  const dictionary = useDictionary();
  const t = dictionary.chatLoginPage;
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
      <TerminalFooter className="mt-auto pt-6 sm:mt-0">
        <TerminalPrompt text={t.footerPrompt} />
      </TerminalFooter>
    </TerminalWindow>
  );
}
