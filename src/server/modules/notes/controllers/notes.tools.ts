import { AppendToNoteToolDTO } from "~/contracts/tools/notes/append-to-note";
import { CreateNoteToolDTO } from "~/contracts/tools/notes/create-note";
import { ListNotesToolDTO } from "~/contracts/tools/notes/list-notes";
import { ReadNoteToolDTO } from "~/contracts/tools/notes/read-note";
import {
  type RegisteredTool,
  requireToolUser,
} from "~/server/modules/chat/services/tool-executor.service";
import type { AuthService } from "~/server/modules/identity/services/auth.service";
import type { NoteService } from "~/server/modules/notes/services/note.service";

export function createNoteTools(
  auth: AuthService,
  noteService: NoteService,
): RegisteredTool[] {
  return [
    {
      name: "create_note",
      description: [
        "Create one named personal note for the authenticated user.",
        "Use this for ideas, references, links, durable prose, or anything worth saving that is not a concrete task with a completion lifecycle.",
        "A brief or rough capture may be expanded into clear standard Markdown, but preserve the user's meaning, facts, uncertainty, links, and language. Do not invent details.",
        "Use a concise descriptive name and structure the Markdown for future readability.",
        "Returns { message, note }.",
      ].join("\n"),
      inputSchema: CreateNoteToolDTO,
      mutating: true,
      run: async (args, context) => {
        const input = CreateNoteToolDTO.parse(args);
        const user = await requireToolUser(auth, context);
        const note = await noteService.createNote({
          idUser: user.id,
          idSourceMessage: context.sourceMessage.id,
          name: input.name,
          markdown: input.markdown,
        });
        return { message: "Note created", note: note.toJSON() };
      },
    },
    {
      name: "list_notes",
      description: [
        "List the user's notes, optionally filtered by a search term.",
        "Use this to find the exact note ID before reading or appending to a note.",
        "Returns metadata and short previews, not full note bodies.",
      ].join("\n"),
      inputSchema: ListNotesToolDTO,
      mutating: false,
      run: async (args, context) => {
        const input = ListNotesToolDTO.parse(args);
        const user = await requireToolUser(auth, context);
        const notes = await noteService.listNotes(user.id, {
          search: input.search,
        });
        return {
          count: notes.length,
          notes: notes.map((note) => ({
            id: note.id,
            name: note.name,
            preview: note.markdown.replace(/\s+/g, " ").trim().slice(0, 180),
            updatedAt: note.updatedAt.toISOString(),
          })),
        };
      },
    },
    {
      name: "read_note",
      description: [
        "Read one complete note using the exact ID returned by list_notes.",
        "The stored body is standard Markdown. Present it faithfully in the formatting supported by the current chat channel without changing its meaning.",
        "Returns { note }.",
      ].join("\n"),
      inputSchema: ReadNoteToolDTO,
      mutating: false,
      run: async (args, context) => {
        const input = ReadNoteToolDTO.parse(args);
        const user = await requireToolUser(auth, context);
        const note = await noteService.getNoteById(user.id, input.note_id);
        return { note: note.toJSON() };
      },
    },
    {
      name: "append_to_note",
      description: [
        "Append standard Markdown to the bottom of one existing note.",
        "Use the exact ID returned by list_notes.",
        "This operation never rewrites or reformats the existing note. Preserve the user's intent and append only the requested information.",
        "Because it is additive and preserves existing content, execute it immediately when the user asks; do not ask for destructive-action confirmation.",
        "Returns { message, note }.",
      ].join("\n"),
      inputSchema: AppendToNoteToolDTO,
      mutating: true,
      run: async (args, context) => {
        const input = AppendToNoteToolDTO.parse(args);
        const user = await requireToolUser(auth, context);
        const note = await noteService.appendToNote(
          user.id,
          input.note_id,
          input.markdown,
        );
        return { message: "Note updated", note: note.toJSON() };
      },
    },
  ];
}
