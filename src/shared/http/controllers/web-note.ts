import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { toNoteResponse } from "~/modules/notes/contracts/NoteContractMapper";
import {
  NoteItemResponseDTO,
  SaveNoteRequestDTO,
} from "~/modules/notes/entities/dtos/NoteDTO";
import { Http } from "~/shared/http/utils/Http";
import { parseJsonRequest } from "~/shared/http/utils/JsonRequest";

export const Route = createFileRoute("/api/v1/web/notes/$noteId")({
  server: {
    handlers: {
      async GET({ context, params }) {
        const noteService = ServerBootstrap.getApplication().services.notes;
        const note = await noteService.getNoteById(
          context.webAuth.userId,
          params.noteId,
        );
        return Http.json(
          NoteItemResponseDTO.parse({ note: toNoteResponse(note) }),
        );
      },
      async PATCH({ request, context, params }) {
        const noteService = ServerBootstrap.getApplication().services.notes;
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
        const noteService = ServerBootstrap.getApplication().services.notes;
        await noteService.deleteNote(context.webAuth.userId, params.noteId);
        return Http.ok();
      },
    },
  },
});
