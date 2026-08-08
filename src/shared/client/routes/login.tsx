import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  LoginScreen,
  normalizeWebLoginSearch,
} from "~/modules/identity/client";
import type { Prefs } from "~/shared/client/entities/Prefs";
import { getDictionary } from "~/shared/client/i18n";
import { requireWebAccess } from "~/shared/http/functions/require-web-access";

export const Route = createFileRoute("/login")({
  validateSearch: normalizeWebLoginSearch,
  beforeLoad: async ({ search }) => {
    const authResult = await requireWebAccess();
    if (authResult.ok) throw redirect({ href: search.redirect });
  },
  component: LoginRoute,
  head: ({ match }) => {
    const dictionary = getDictionary((match.context as Partial<Prefs>).locale);
    return {
      meta: [
        {
          title: `${dictionary.loginPage.heading} - ${dictionary.meta.siteTitle}`,
        },
      ],
    };
  },
});

function LoginRoute() {
  const search = Route.useSearch();
  return <LoginScreen redirectTo={search.redirect} />;
}
