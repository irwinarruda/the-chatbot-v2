import { createFileRoute } from "@tanstack/react-router";
import {
  CreateNoteRequestDTO,
  NoteItemResponseDTO,
  NotesResponseDTO,
} from "~/contracts/http/notes/note";
import { toNoteResponse } from "~/contracts/http/notes/note-mapper";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";
import { parseJsonRequest } from "~/server/shared/http/utils/json-request";

export const Route = createFileRoute("/api/v1/web/notes")({
  server: {
    handlers: {
      async GET({ request, context }) {
        const noteService = getServer().services.notes;
        const search = new URL(request.url).searchParams.get("q") ?? undefined;
        const notes = await noteService.listNotes(context.webAuth.userId, {
          search,
        });
        return Http.json(
          NotesResponseDTO.parse({ notes: notes.map(toNoteResponse) }),
        );
      },
      async POST({ request, context }) {
        const noteService = getServer().services.notes;
        const body = CreateNoteRequestDTO.parse(
          await parseJsonRequest(request),
        );
        const note = await noteService.createNote({
          idUser: context.webAuth.userId,
          name: body.name,
          markdown: body.markdown,
        });
        return Http.json(
          NoteItemResponseDTO.parse({ note: toNoteResponse(note) }),
        );
      },
    },
  },
});
