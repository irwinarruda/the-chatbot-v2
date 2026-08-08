import { createFileRoute, redirect } from "@tanstack/react-router";
import { normalizeWebLoginRedirect } from "~/modules/identity/utils/WebLoginNavigation";
import { NotesScreen, normalizeNotesSearch } from "~/modules/notes/client";
import { requireWebAccess } from "~/shared/http/functions/require-web-access";

export const Route = createFileRoute("/notes")({
  beforeLoad: async ({ location }) => {
    const authResult = await requireWebAccess();
    if (!authResult.ok) {
      throw redirect({
        to: "/login",
        search: { redirect: normalizeWebLoginRedirect(location.href) },
      });
    }
  },
  validateSearch: normalizeNotesSearch,
  component: NotesRoute,
  head: () => ({ meta: [{ title: "Notes - The Chatbot" }] }),
});

function NotesRoute() {
  return <NotesScreen search={Route.useSearch()} />;
}
