import { createFileRoute, redirect } from "@tanstack/react-router";
import { normalizeWebLoginSearch } from "~/client/modules/identity/app/dtos/WebLoginSearchDTO";
import { LoginScreen } from "~/client/modules/identity/screens/LoginScreen";
import type { Prefs } from "~/client/shared/app/entities/Prefs";
import { getDictionary } from "~/client/shared/i18n/dictionary";
import { requireWebAccess } from "~/server/shared/http/functions/require-web-access";

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
