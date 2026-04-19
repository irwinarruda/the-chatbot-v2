import { createFileRoute } from "@tanstack/react-router";
import { usePrefs } from "~/client/components/PrefsProvider";
import { PrivacyPolicyPage } from "~/client/components/pages/PublicPages";
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
  return (
    <PrivacyPolicyPage dictionary={dictionary} contentHtml={contentHtml} />
  );
}
