import { createFileRoute, redirect } from "@tanstack/react-router";
import { ArtifactsScreen } from "~/client/modules/artifacts/screens/ArtifactsScreen";
import { normalizeWebLoginRedirect } from "~/contracts/http/identity/web-login-navigation";
import { requireWebAccess } from "~/server/shared/http/functions/require-web-access";

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
