import { beforeEach, describe, expect, test } from "vitest";
import { MessageContentType } from "~/modules/chat/entities/enums/MessageContentType";
import { ToolResultStatus } from "~/modules/chat/entities/enums/ToolResultStatus";
import { orquestrator } from "~/tests/orquestrator";

describe("note AI tools", () => {
  beforeEach(async () => {
    await orquestrator.clearDatabase();
  });

  test("creates, lists, reads, and appends to a note", async () => {
    const user = await orquestrator.createUser();
    const chat = await orquestrator.messagingService.receiveWebMessage(
      user.email ?? "",
      { text: "Anota minha ideia para um editor Markdown" },
    );
    const sourceMessage = chat?.messages[0];
    expect(chat).toBeDefined();
    expect(sourceMessage).toBeDefined();
    if (!chat || !sourceMessage) return;

    const created = await orquestrator.aiToolService.execute(
      {
        type: MessageContentType.ToolCall,
        callId: "create-note",
        name: "create_note",
        arguments: {
          name: "Editor Markdown",
          markdown: "# Ideia\n\nCriar um editor simples e agradável.",
        },
      },
      { chat, sourceMessage },
    );
    expect(created.outcome).toMatchObject({
      status: ToolResultStatus.Succeeded,
      data: { note: { name: "Editor Markdown" } },
    });

    const [note] = await orquestrator.noteService.listNotes(user.id);
    expect(note.idSourceMessage).toBe(sourceMessage.id);
    const listed = await orquestrator.aiToolService.execute(
      {
        type: MessageContentType.ToolCall,
        callId: "list-notes",
        name: "list_notes",
        arguments: { search: "Markdown" },
      },
      { chat, sourceMessage },
    );
    expect(listed.outcome).toMatchObject({
      status: ToolResultStatus.Succeeded,
      data: { count: 1, notes: [{ id: note.id }] },
    });

    const appended = await orquestrator.aiToolService.execute(
      {
        type: MessageContentType.ToolCall,
        callId: "append-note",
        name: "append_to_note",
        arguments: {
          note_id: note.id,
          markdown: "## Link\n\nhttps://mdxeditor.dev",
        },
      },
      { chat, sourceMessage },
    );
    expect(appended.outcome).toMatchObject({
      status: ToolResultStatus.Succeeded,
      data: { note: { markdown: expect.stringContaining("## Link") } },
    });

    const read = await orquestrator.aiToolService.execute(
      {
        type: MessageContentType.ToolCall,
        callId: "read-note",
        name: "read_note",
        arguments: { note_id: note.id },
      },
      { chat, sourceMessage },
    );
    expect(read.outcome).toMatchObject({
      status: ToolResultStatus.Succeeded,
      data: { note: { markdown: expect.stringContaining("mdxeditor.dev") } },
    });
  });
});
