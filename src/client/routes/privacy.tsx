import { createFileRoute } from "@tanstack/react-router";
import { TerminalWindow } from "~/client/components/TerminalWindow";
import type { Prefs } from "~/client/entities/Prefs";
import { getDictionary } from "~/client/i18n";
import { useDictionary } from "~/client/providers/useDictionary";
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
      <div className="terminal-prose">
        <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
      </div>
      <div className="mt-8 border-term-border border-t pt-5 text-[0.8125rem] text-term-muted">
        &copy; {t.copyright}
      </div>
    </TerminalWindow>
  );
}
