import { createFileRoute } from "@tanstack/react-router";
import { normalizeNotesSearch } from "~/client/modules/notes/app/dtos/NotesSearchDTO";
import { NoteDetailScreen } from "~/client/modules/notes/screens/NoteDetailScreen";

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
