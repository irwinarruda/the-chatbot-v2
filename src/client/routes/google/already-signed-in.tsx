import { createFileRoute } from "@tanstack/react-router";
import { usePrefs } from "~/client/components/PrefsProvider";
import { AlreadySignedInPage } from "~/client/components/pages/PublicPages";
import { getDictionary, type Locale } from "~/client/i18n";

export const Route = createFileRoute("/google/already-signed-in")({
  component: AlreadySignedInRoute,
  head: ({ match }) => ({
    meta: [
      {
        title: getDictionary((match.context as { locale?: Locale }).locale).meta
          .connectedTitle,
      },
    ],
  }),
});

function AlreadySignedInRoute() {
  const { locale } = usePrefs();
  const dictionary = getDictionary(locale);
  return <AlreadySignedInPage dictionary={dictionary} />;
}
