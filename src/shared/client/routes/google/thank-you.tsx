import { createFileRoute } from "@tanstack/react-router";
import { ThankYouScreen } from "~/modules/identity/client";
import type { Prefs } from "~/shared/client/entities/Prefs";
import { getDictionary } from "~/shared/client/i18n";

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
