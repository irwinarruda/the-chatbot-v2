import { Link } from "@tanstack/react-router";
import { getWebLoginActivePath } from "~/modules/identity/utils/WebLoginNavigation";
import { TerminalFooter } from "~/shared/client/components/terminal/TerminalFooter";
import { TerminalPageHeader } from "~/shared/client/components/terminal/TerminalPageHeader";
import { TerminalPanel } from "~/shared/client/components/terminal/TerminalPanel";
import { TerminalPanelText } from "~/shared/client/components/terminal/TerminalPanelText";
import { TerminalWindow } from "~/shared/client/components/terminal/TerminalWindow";
import { Button } from "~/shared/client/components/ui/button";
import { useDictionary } from "~/shared/client/providers/useDictionary";

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
          className="h-auto px-0 font-mono text-term-blue hover:text-term-cyan"
        >
          <span aria-hidden="true" className="font-semibold text-term-green">
            $
          </span>
          {t.backLink}
        </Button>
      </TerminalFooter>
    </TerminalWindow>
  );
}
