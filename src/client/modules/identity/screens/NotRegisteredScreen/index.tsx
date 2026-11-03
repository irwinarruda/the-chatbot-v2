import { Link } from "@tanstack/react-router";
import { TerminalFooter } from "~/client/shared/components/terminal/TerminalFooter";
import { TerminalPageHeader } from "~/client/shared/components/terminal/TerminalPageHeader";
import { TerminalPanel } from "~/client/shared/components/terminal/TerminalPanel";
import { TerminalPanelText } from "~/client/shared/components/terminal/TerminalPanelText";
import { TerminalWindow } from "~/client/shared/components/terminal/TerminalWindow";
import { Button } from "~/client/shared/components/ui/button";
import { useDictionary } from "~/client/shared/hooks/useDictionary";
import { getWebLoginActivePath } from "~/contracts/http/identity/web-login-navigation";

export function NotRegisteredScreen({ redirectTo }: { redirectTo: string }) {
  const dictionary = useDictionary();
  const t = dictionary.notRegisteredPage;
  const activePath = getWebLoginActivePath(redirectTo);

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
      </TerminalPanel>
      <TerminalFooter className="mt-auto pt-6">
        <Button
          nativeButton={false}
          render={<Link to="/" />}
          variant="link"
          className="h-auto px-0 font-mono text-info"
        >
          <span aria-hidden="true" className="font-semibold text-primary">
            $
          </span>
          {t.backLink}
        </Button>
      </TerminalFooter>
    </TerminalWindow>
  );
}
