import { createFileRoute, redirect } from "@tanstack/react-router";
import { normalizeNotesSearch } from "~/client/modules/notes/app/dtos/NotesSearchDTO";
import { NotesScreen } from "~/client/modules/notes/screens/NotesScreen";
import { useApp } from "~/client/shared/stores/app";
import { normalizeWebLoginRedirect } from "~/contracts/http/identity/web-login-navigation";

export const Route = createFileRoute("/notes")({
  beforeLoad: async ({ location }) => {
    const { hasWebAccess } = useApp.getState();
    if (!(await hasWebAccess())) {
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
