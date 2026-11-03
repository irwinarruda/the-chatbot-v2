import { TerminalFooter } from "~/client/shared/components/terminal/TerminalFooter";
import { TerminalPageHeader } from "~/client/shared/components/terminal/TerminalPageHeader";
import { TerminalPanel } from "~/client/shared/components/terminal/TerminalPanel";
import { TerminalPanelText } from "~/client/shared/components/terminal/TerminalPanelText";
import { TerminalPrompt } from "~/client/shared/components/terminal/TerminalPrompt";
import { TerminalWindow } from "~/client/shared/components/terminal/TerminalWindow";
import { Button } from "~/client/shared/components/ui/button";
import { useDictionary } from "~/client/shared/hooks/useDictionary";
import { getWebLoginActivePath } from "~/contracts/http/identity/web-login-navigation";
import { GoogleIcon } from "./GoogleIcon";

export function LoginScreen({ redirectTo }: { redirectTo: string }) {
  const dictionary = useDictionary();
  const t = dictionary.loginPage;
  const activePath = getWebLoginActivePath(redirectTo);
  const loginHref = `/api/v1/web/auth/login?redirect=${encodeURIComponent(redirectTo)}`;

  return (
    <TerminalWindow
      title={t.windowTitle}
      activePath={activePath}
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
          render={<a href={loginHref} />}
          variant="outline"
          className="mt-2 h-11 w-full max-w-sm rounded-md bg-popover px-4 font-semibold text-popover-foreground text-sm"
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
