import { createFileRoute } from "@tanstack/react-router";
import type { Prefs } from "~/client/shared/app/entities/Prefs";
import { AppShell } from "~/client/shared/components/terminal/AppShell";
import { TerminalFooter } from "~/client/shared/components/terminal/TerminalFooter";
import { useDictionary } from "~/client/shared/hooks/useDictionary";
import { getDictionary } from "~/client/shared/i18n/dictionary";
import { loadPrivacyContent } from "~/server/shared/http/functions/load-privacy";

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
    <AppShell
      title={t.windowTitle}
      activePath="/privacy"
      dictionary={dictionary}
    >
      <div className="mx-auto w-full max-w-3xl">
        <article className="terminal-prose reading-surface">
          <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
        </article>
        <TerminalFooter className="mt-8">&copy; {t.copyright}</TerminalFooter>
      </div>
    </AppShell>
  );
}
