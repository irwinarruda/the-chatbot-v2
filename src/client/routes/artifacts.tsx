import { createFileRoute, redirect } from "@tanstack/react-router";
import { ArtifactsScreen } from "~/client/modules/artifacts/screens/ArtifactsScreen";
import { useApp } from "~/client/shared/stores/app";
import { normalizeWebLoginRedirect } from "~/contracts/http/identity/web-login-navigation";

export const Route = createFileRoute("/artifacts")({
  beforeLoad: async ({ location }) => {
    const { hasWebAccess } = useApp.getState();
    if (!(await hasWebAccess())) {
      throw redirect({
        to: "/login",
        search: { redirect: normalizeWebLoginRedirect(location.href) },
      });
    }
  },
  component: ArtifactsScreen,
  head: () => ({ meta: [{ title: "Artifacts - The Chatbot" }] }),
});
