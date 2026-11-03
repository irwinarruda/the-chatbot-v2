import { createFileRoute } from "@tanstack/react-router";
import { AlreadySignedInScreen } from "~/client/modules/identity/screens/AlreadySignedInScreen";
import type { Prefs } from "~/client/shared/app/entities/Prefs";
import { getDictionary } from "~/client/shared/i18n/dictionary";

export const Route = createFileRoute("/google/already-signed-in")({
  component: AlreadySignedInScreen,
  head: ({ match }) => ({
    meta: [
      {
        title: getDictionary((match.context as Partial<Prefs>).locale).meta
          .connectedTitle,
      },
    ],
  }),
});
