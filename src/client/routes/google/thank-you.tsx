import { createFileRoute } from "@tanstack/react-router";
import { usePrefs } from "~/client/components/PrefsProvider";
import { ThankYouPage } from "~/client/components/pages/PublicPages";
import { getDictionary, type Locale } from "~/client/i18n";

export const Route = createFileRoute("/google/thank-you")({
  component: ThankYouRoute,
  head: ({ match }) => ({
    meta: [
      {
        title: getDictionary((match.context as { locale?: Locale }).locale).meta
          .thankYouTitle,
      },
    ],
  }),
});

function ThankYouRoute() {
  const { locale } = usePrefs();
  const dictionary = getDictionary(locale);
  return <ThankYouPage dictionary={dictionary} />;
}
