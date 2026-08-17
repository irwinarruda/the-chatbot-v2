import { createFileRoute, redirect } from "@tanstack/react-router";
import { ArtifactsScreen } from "~/modules/artifacts/client/screens/ArtifactsScreen";
import { normalizeWebLoginRedirect } from "~/modules/identity/utils/WebLoginNavigation";
import { requireWebAccess } from "~/shared/http/functions/require-web-access";

export const Route = createFileRoute("/artifacts")({
  beforeLoad: async ({ location }) => {
    const authResult = await requireWebAccess();
    if (!authResult.ok) {
      throw redirect({
        to: "/login",
        search: { redirect: normalizeWebLoginRedirect(location.href) },
      });
    }
  },
  component: ArtifactsScreen,
  head: () => ({ meta: [{ title: "Artifacts - The Chatbot" }] }),
});
