import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import {
  RefineNoteRequestDTO,
  RefineNoteResponseDTO,
} from "~/modules/notes/entities/dtos/NoteDTO";
import { Http } from "~/shared/http/utils/Http";
import { parseJsonRequest } from "~/shared/http/utils/JsonRequest";

export const Route = createFileRoute("/api/v1/web/notes/refine")({
  server: {
    handlers: {
      async POST({ request, context }) {
        const noteService = ServerBootstrap.getApplication().services.notes;
        const body = RefineNoteRequestDTO.parse(
          await parseJsonRequest(request),
        );
        const markdown = await noteService.refineMarkdown(
          context.webAuth.userId,
          body.markdown,
          body.instruction,
        );
        return Http.json(RefineNoteResponseDTO.parse({ markdown }));
      },
    },
  },
});
