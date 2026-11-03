import { createFileRoute } from "@tanstack/react-router";
import {
  NoteItemResponseDTO,
  SaveNoteRequestDTO,
} from "~/contracts/http/notes/note";
import { toNoteResponse } from "~/contracts/http/notes/note-mapper";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";
import { parseJsonRequest } from "~/server/shared/http/utils/json-request";

export const Route = createFileRoute("/api/v1/web/notes/$noteId")({
  server: {
    handlers: {
      async GET({ context, params }) {
        const noteService = getServer().services.notes;
        const note = await noteService.getNoteById(
          context.webAuth.userId,
          params.noteId,
        );
        return Http.json(
          NoteItemResponseDTO.parse({ note: toNoteResponse(note) }),
        );
      },
      async PATCH({ request, context, params }) {
        const noteService = getServer().services.notes;
        const body = SaveNoteRequestDTO.parse(await parseJsonRequest(request));
        const note = await noteService.updateNote({
          idUser: context.webAuth.userId,
          id: params.noteId,
          name: body.name,
          markdown: body.markdown,
        });
        return Http.json(
          NoteItemResponseDTO.parse({ note: toNoteResponse(note) }),
        );
      },
      async DELETE({ context, params }) {
        const noteService = getServer().services.notes;
        await noteService.deleteNote(context.webAuth.userId, params.noteId);
        return Http.ok();
      },
    },
  },
});
