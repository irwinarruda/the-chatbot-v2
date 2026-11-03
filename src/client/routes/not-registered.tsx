import { createFileRoute, redirect } from "@tanstack/react-router";
import { normalizeWebLoginSearch } from "~/client/modules/identity/app/dtos/WebLoginSearchDTO";
import { NotRegisteredScreen } from "~/client/modules/identity/screens/NotRegisteredScreen";
import type { Prefs } from "~/client/shared/app/entities/Prefs";
import { getDictionary } from "~/client/shared/i18n/dictionary";
import { requireWebAccess } from "~/server/shared/http/functions/require-web-access";

export const Route = createFileRoute("/not-registered")({
  validateSearch: normalizeWebLoginSearch,
  beforeLoad: async ({ search }) => {
    const authResult = await requireWebAccess();
    if (authResult.ok) throw redirect({ href: search.redirect });
  },
  component: NotRegisteredRoute,
  head: ({ match }) => {
    const dictionary = getDictionary((match.context as Partial<Prefs>).locale);
    return {
      meta: [
        {
          title: `${dictionary.notRegisteredPage.heading} - ${dictionary.meta.siteTitle}`,
        },
      ],
    };
  },
});

function NotRegisteredRoute() {
  const search = Route.useSearch();
  return <NotRegisteredScreen redirectTo={search.redirect} />;
}
