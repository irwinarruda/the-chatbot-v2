import { createFileRoute } from "@tanstack/react-router";
import { NotRegisteredScreen } from "~/modules/identity/client";
import type { Prefs } from "~/shared/client/entities/Prefs";
import { getDictionary } from "~/shared/client/i18n";

export const Route = createFileRoute("/chat/not-registered")({
  component: NotRegisteredScreen,
  head: ({ match }) => {
    const dictionary = getDictionary((match.context as Partial<Prefs>).locale);
    return {
      meta: [
        {
          title: `${dictionary.chatNotRegisteredPage.heading} - ${dictionary.meta.siteTitle}`,
        },
      ],
    };
  },
});
