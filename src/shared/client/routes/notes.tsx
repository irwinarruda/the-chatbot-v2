import { createFileRoute, redirect } from "@tanstack/react-router";
import { NotesScreen, normalizeNotesSearch } from "~/modules/notes/client";
import { requireWebAccess } from "~/shared/http/functions/require-web-access";

export const Route = createFileRoute("/notes")({
  beforeLoad: async () => {
    const authResult = await requireWebAccess();
    if (!authResult.ok) throw redirect({ to: "/chat/login" });
  },
  validateSearch: normalizeNotesSearch,
  component: NotesRoute,
  head: () => ({ meta: [{ title: "Notes - The Chatbot" }] }),
});

function NotesRoute() {
  return <NotesScreen search={Route.useSearch()} />;
}
