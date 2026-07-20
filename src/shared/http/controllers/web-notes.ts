import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { toNoteResponse } from "~/modules/notes/contracts/NoteContractMapper";
import {
  CreateNoteRequestDTO,
  NoteItemResponseDTO,
  NotesResponseDTO,
} from "~/modules/notes/entities/dtos/NoteDTO";
import { Http } from "~/shared/http/utils/Http";
import { parseJsonRequest } from "~/shared/http/utils/JsonRequest";

export const Route = createFileRoute("/api/v1/web/notes")({
  server: {
    handlers: {
      async GET({ request, context }) {
        const noteService = ServerBootstrap.getApplication().services.notes;
        const search = new URL(request.url).searchParams.get("q") ?? undefined;
        const notes = await noteService.listNotes(context.webAuth.userId, {
          search,
        });
        return Http.json(
          NotesResponseDTO.parse({ notes: notes.map(toNoteResponse) }),
        );
      },
      async POST({ request, context }) {
        const noteService = ServerBootstrap.getApplication().services.notes;
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
