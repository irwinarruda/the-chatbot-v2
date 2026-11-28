import { createFileRoute, redirect } from "@tanstack/react-router";
import { normalizeOAuthConsentSearch } from "~/client/modules/mcp/app/dtos/OAuthConsentSearchDTO";
import { OAuthConsentScreen } from "~/client/modules/mcp/screens/OAuthConsentScreen";
import type { Prefs } from "~/client/shared/app/entities/Prefs";
import { getDictionary } from "~/client/shared/i18n/dictionary";
import { useApp } from "~/client/shared/stores/app";
import { normalizeWebLoginRedirect } from "~/contracts/http/identity/web-login-navigation";

export const Route = createFileRoute("/oauth/authorize")({
  validateSearch: normalizeOAuthConsentSearch,
  beforeLoad: async ({ location }) => {
    const { hasWebAccess } = useApp.getState();
    if (!(await hasWebAccess())) {
      throw redirect({
        to: "/login",
        search: { redirect: normalizeWebLoginRedirect(location.href) },
      });
    }
  },
  component: OAuthConsentRoute,
  head: ({ match }) => {
    const dictionary = getDictionary((match.context as Partial<Prefs>).locale);
    return {
      meta: [
        {
          title: `${dictionary.oauthConsentPage.heading} - ${dictionary.meta.siteTitle}`,
        },
        { name: "robots", content: "noindex" },
      ],
    };
  },
});

function OAuthConsentRoute() {
  return <OAuthConsentScreen authorizationQuery={Route.useSearch().request} />;
}
