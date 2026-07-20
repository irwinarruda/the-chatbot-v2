import { afterEach, describe, expect, test, vi } from "vitest";
import { noteService } from "~/modules/notes/client/services/noteService";

const noteId = "d8749e8c-57a9-4b9c-b6f7-392238f63312";
const markdown = "# Idea\n\n[Read later](https://example.com)\n";
const noteResponse = {
  note: {
    id: noteId,
    name: "Reading list",
    markdown,
    created_at: "2026-07-20T12:00:00.000Z",
    updated_at: "2026-07-20T12:00:00.000Z",
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("noteService", () => {
  test("preserves Markdown in create and update request bodies", async () => {
    const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) =>
      Response.json(noteResponse, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await noteService.createNote({ name: "Reading list", markdown });
    await noteService.updateNote(noteId, { markdown });

    const requestBodies = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse(String(init?.body)),
    );
    expect(requestBodies).toEqual([
      { name: "Reading list", markdown },
      { markdown },
    ]);
  });

  test("returns an AI-refined Markdown draft without saving it", async () => {
    const revised = "# Better idea\n\n- Keep it portable";
    const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) =>
      Response.json({ markdown: revised }, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      noteService.refineNote({ markdown, instruction: "Organize it" }),
    ).resolves.toBe(revised);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/web/notes/refine",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
