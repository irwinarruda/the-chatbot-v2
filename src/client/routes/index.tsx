import { createFileRoute } from "@tanstack/react-router";
import { usePrefs } from "~/client/components/PrefsProvider";
import { WelcomePage } from "~/client/components/pages/PublicPages";
import { getDictionary, type Locale } from "~/client/i18n";

export const Route = createFileRoute("/")({
  component: IndexRoute,
  head: ({ match }) => ({
    meta: [
      {
        title: getDictionary((match.context as { locale?: Locale }).locale).meta
          .welcomeTitle,
      },
    ],
  }),
});

function IndexRoute() {
  const { locale } = usePrefs();
  const dictionary = getDictionary(locale);
  return <WelcomePage dictionary={dictionary} />;
}
