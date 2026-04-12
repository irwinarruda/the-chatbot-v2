import { createFileRoute } from "@tanstack/react-router";
import { usePrefs } from "~/components/PrefsProvider";
import { AlreadySignedInPage } from "~/components/pages/PublicPages";
import { getDictionary, type Locale } from "~/i18n";

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
