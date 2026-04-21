import { createFileRoute } from "@tanstack/react-router";
import { usePrefs } from "~/client/components/PrefsProvider";
import { TerminalWindow } from "~/client/components/TerminalWindow";
import { getDictionary, type Locale } from "~/client/i18n";
import { loadPrivacyContent } from "~/server/tanstack/functions/load-privacy";

export const Route = createFileRoute("/privacy")({
  component: PrivacyRoute,
  head: ({ match }) => ({
    meta: [
      {
        title: getDictionary((match.context as { locale?: Locale }).locale).meta
          .privacyTitle,
      },
    ],
  }),
  loader: () => loadPrivacyContent(),
});

function PrivacyRoute() {
  const contentHtml = Route.useLoaderData();
  const { locale } = usePrefs();
  const dictionary = getDictionary(locale);
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
