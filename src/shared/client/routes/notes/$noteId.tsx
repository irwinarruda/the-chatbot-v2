import { createFileRoute } from "@tanstack/react-router";
import { NoteDetailScreen, normalizeNotesSearch } from "~/modules/notes/client";

export const Route = createFileRoute("/notes/$noteId")({
  validateSearch: normalizeNotesSearch,
  component: NoteDetailRoute,
  head: () => ({ meta: [{ title: "Note - The Chatbot" }] }),
});

function NoteDetailRoute() {
  return (
    <NoteDetailScreen
      noteId={Route.useParams().noteId}
      search={Route.useSearch()}
    />
  );
}
