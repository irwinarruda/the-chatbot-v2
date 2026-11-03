import { createFileRoute } from "@tanstack/react-router";
import {
  RefineNoteRequestDTO,
  RefineNoteResponseDTO,
} from "~/contracts/http/notes/note";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";
import { parseJsonRequest } from "~/server/shared/http/utils/json-request";

export const Route = createFileRoute("/api/v1/web/notes/refine")({
  server: {
    handlers: {
      async POST({ request, context }) {
        const noteService = getServer().services.notes;
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
