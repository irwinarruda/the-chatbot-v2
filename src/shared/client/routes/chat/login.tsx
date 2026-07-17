import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginScreen } from "~/modules/identity/client";
import type { Prefs } from "~/shared/client/entities/Prefs";
import { getDictionary } from "~/shared/client/i18n";
import { requireWebAccess } from "~/shared/http/functions/require-web-access";

export const Route = createFileRoute("/chat/login")({
  beforeLoad: async () => {
    const authResult = await requireWebAccess();
    if (authResult.ok) {
      throw redirect({ to: "/chat" });
    }
  },
  component: LoginScreen,
  head: ({ match }) => {
    const dictionary = getDictionary((match.context as Partial<Prefs>).locale);
    return {
      meta: [
        {
          title: `${dictionary.chatLoginPage.heading} - ${dictionary.meta.siteTitle}`,
        },
      ],
    };
  },
});
