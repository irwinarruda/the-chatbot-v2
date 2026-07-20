import { beforeEach, describe, expect, test } from "vitest";
import { NotFoundException } from "~/shared/errors/ApplicationErrors";
import { ValidationException } from "~/shared/errors/DomainErrors";
import { orquestrator } from "~/tests/orquestrator";

describe("NoteService", () => {
  beforeEach(async () => {
    await orquestrator.clearDatabase();
    orquestrator.aiGateway.generatedTextRequests = [];
    orquestrator.aiGateway.scriptedTexts = [];
  });

  test("preserves Markdown through create, read, update, search, and append", async () => {
    const user = await orquestrator.createUser();
    const markdown =
      "# New idea\n\n- [ ] Test it\n\n```ts\nconst value = 1;\n```\n\n[Docs](https://example.com)\n";
    const created = await orquestrator.noteService.createNote({
      idUser: user.id,
      name: "Editor idea",
      markdown,
    });

    expect(created.markdown).toBe(markdown);
    expect(
      await orquestrator.noteService.getNoteById(user.id, created.id),
    ).toMatchObject({ markdown });
    expect(
      await orquestrator.noteService.listNotes(user.id, { search: "Docs" }),
    ).toHaveLength(1);

    const replacement = "## Decision\n\nKeep the Markdown source.  \n";
    const updated = await orquestrator.noteService.updateNote({
      idUser: user.id,
      id: created.id,
      markdown: replacement,
    });
    expect(updated.markdown).toBe(replacement);

    const appended = await orquestrator.noteService.appendToNote(
      user.id,
      created.id,
      "### Follow-up\n\nShip the first pass",
    );
    expect(appended.markdown).toBe(
      `${replacement}\n\n### Follow-up\n\nShip the first pass`,
    );
  });

  test("keeps names unique per user and scopes reads and deletes by owner", async () => {
    const user = await orquestrator.createUser();
    const otherUser = await orquestrator.createUser();
    const note = await orquestrator.noteService.createNote({
      idUser: user.id,
      name: "Reading list",
    });

    await expect(
      orquestrator.noteService.createNote({
        idUser: user.id,
        name: "reading LIST",
      }),
    ).rejects.toThrow(ValidationException);
    await expect(
      orquestrator.noteService.getNoteById(otherUser.id, note.id),
    ).rejects.toThrow(NotFoundException);
    await expect(
      orquestrator.noteService.deleteNote(otherUser.id, note.id),
    ).rejects.toThrow(NotFoundException);
  });

  test("refines a draft without persisting it automatically", async () => {
    orquestrator.aiGateway.scriptedTexts.push(
      "```markdown\n# Organized\n\n- First point\n```",
    );

    const revised = await orquestrator.noteService.refineMarkdown(
      "rough idea",
      "Organize this",
    );

    expect(revised).toBe("# Organized\n\n- First point");
    expect(orquestrator.aiGateway.generatedTextRequests).toHaveLength(1);
    expect(orquestrator.aiGateway.generatedTextRequests[0]?.userText).toContain(
      '"instruction":"Organize this"',
    );
    expect(orquestrator.aiGateway.generatedTextRequests[0]?.userText).toContain(
      '"markdown":"rough idea"',
    );
  });
});
