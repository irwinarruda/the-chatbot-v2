import { createFileRoute } from "@tanstack/react-router";
import { ThankYouScreen } from "~/client/modules/identity/screens/ThankYouScreen";
import type { Prefs } from "~/client/shared/app/entities/Prefs";
import { getDictionary } from "~/client/shared/i18n/dictionary";

export const Route = createFileRoute("/google/thank-you")({
  component: ThankYouScreen,
  head: ({ match }) => ({
    meta: [
      {
        title: getDictionary((match.context as Partial<Prefs>).locale).meta
          .thankYouTitle,
      },
    ],
  }),
});
