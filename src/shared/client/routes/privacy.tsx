import { createFileRoute } from "@tanstack/react-router";
import { TerminalFooter } from "~/shared/client/components/terminal/TerminalFooter";
import { TerminalWindow } from "~/shared/client/components/terminal/TerminalWindow";
import type { Prefs } from "~/shared/client/entities/Prefs";
import { getDictionary } from "~/shared/client/i18n";
import { useDictionary } from "~/shared/client/providers/useDictionary";
import { loadPrivacyContent } from "~/shared/http/functions/load-privacy";

export const Route = createFileRoute("/privacy")({
  component: PrivacyRoute,
  head: ({ match }) => ({
    meta: [
      {
        title: getDictionary((match.context as Partial<Prefs>).locale).meta
          .privacyTitle,
      },
    ],
  }),
  loader: () => loadPrivacyContent(),
});

function PrivacyRoute() {
  const contentHtml = Route.useLoaderData();
  const dictionary = useDictionary();
  const t = dictionary.privacyPage;

  return (
    <TerminalWindow
      title={t.windowTitle}
      wide
      activePath="/privacy"
      dictionary={dictionary}
    >
      <article className="terminal-prose">
        <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
      </article>
      <TerminalFooter className="mt-8">&copy; {t.copyright}</TerminalFooter>
    </TerminalWindow>
  );
}
