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
    >
      <TerminalPageHeader
        heading={t.heading}
        subtitle={t.subtitle}
        withLogo={false}
      />
      <TerminalPanel centered>
        <TerminalPanelText>{t.body}</TerminalPanelText>
        <Button
          nativeButton={false}
          render={<a href="/api/v1/web/auth/login" />}
          className="mt-2 h-11 w-full max-w-sm rounded-md border border-term-border bg-white px-4 font-semibold text-slate-900 text-sm hover:bg-slate-100"
        >
          <GoogleIcon className="size-4" />
          <span>{t.loginButton}</span>
        </Button>
      </TerminalPanel>
      <TerminalFooter className="mt-auto pt-6">
        <TerminalPrompt text={t.footerPrompt} />
      </TerminalFooter>
    </TerminalWindow>
  );
}
