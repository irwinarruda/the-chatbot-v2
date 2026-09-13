import { describe, expect, test, vi } from "vitest";
import { create } from "zustand";
import type { noteService } from "~/modules/notes/client/services/noteService";
import {
  createNoteSlice,
  type NoteSlice,
} from "~/modules/notes/client/state/noteSlice";
import type { NoteDTO } from "~/modules/notes/entities/dtos/NoteDTO";
import { createDeferred } from "~/tests/utils/createDeferred";

const firstNote: NoteDTO = {
  id: "first",
  name: "First",
  markdown: "First text",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};
const secondNote: NoteDTO = { ...firstNote, id: "second", name: "Second" };

function createService() {
  return {
    listNotes: vi.fn<typeof noteService.listNotes>(async () => []),
    getNote: vi.fn<typeof noteService.getNote>(async () => firstNote),
    createNote: vi.fn<typeof noteService.createNote>(async () => firstNote),
    updateNote: vi.fn<typeof noteService.updateNote>(async () => firstNote),
    deleteNote: vi.fn<typeof noteService.deleteNote>(async () => {}),
    refineNote: vi.fn<typeof noteService.refineNote>(async () => "Refined"),
  };
}

describe("noteSlice", () => {
  test("keeps the newest search and ignores an older failed request", async () => {
    const pending = createDeferred<NoteDTO[]>();
    const service = createService();
    service.listNotes
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce([secondNote]);
    const store = create<NoteSlice>()(createNoteSlice(service));
    const first = store.getState().bootstrapNotes("first");
    await store.getState().bootstrapNotes("second");
    pending.reject(new Error("Old request failed"));
    await first;
    expect(store.getState().notes).toEqual([secondNote]);
    expect(store.getState().noteError).toBeUndefined();
    expect(store.getState().isNoteBootstrapping).toBe(false);
  });

  test("does not finish loading when an older search resolves first", async () => {
    const first = createDeferred<NoteDTO[]>();
    const second = createDeferred<NoteDTO[]>();
    const service = createService();
    service.listNotes
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const store = create<NoteSlice>()(createNoteSlice(service));
    const firstLoad = store.getState().bootstrapNotes("first");
    const secondLoad = store.getState().bootstrapNotes("second");
    first.resolve([firstNote]);
    await firstLoad;
    expect(store.getState().isNoteBootstrapping).toBe(true);
    expect(store.getState().notes).toEqual([]);
    second.resolve([secondNote]);
    await secondLoad;
    expect(store.getState().notes).toEqual([secondNote]);
  });

  test("ignores a detail response after selecting another cached note", async () => {
    const pending = createDeferred<NoteDTO>();
    const service = createService();
    service.getNote.mockReturnValueOnce(pending.promise);
    const store = create<NoteSlice>()(createNoteSlice(service));
    store.setState({ notes: [secondNote], selectedNote: firstNote });
    const firstLoad = store.getState().loadNote(firstNote.id);
    expect(store.getState().selectedNote).toBeUndefined();
    await store.getState().loadNote(secondNote.id);
    pending.resolve(firstNote);
    await firstLoad;
    expect(store.getState().selectedNote).toEqual(secondNote);
  });

  test("preserves another selected note when saving or deleting completes", async () => {
    const pending = createDeferred<NoteDTO>();
    const service = createService();
    service.updateNote.mockReturnValueOnce(pending.promise);
    const store = create<NoteSlice>()(createNoteSlice(service));
    store.setState({ notes: [firstNote, secondNote], selectedNote: firstNote });
    const saving = store
      .getState()
      .updateNote(firstNote.id, { name: "Updated" });
    await store.getState().loadNote(secondNote.id);
    pending.resolve({ ...firstNote, name: "Updated" });
    await saving;
    expect(store.getState().selectedNote).toEqual(secondNote);
    expect(await store.getState().deleteNote(firstNote.id)).toBe(true);
    expect(store.getState().selectedNote).toEqual(secondNote);
  });
  test("a list begun before or during a create cannot hide the created note", async () => {
    const oldList = createDeferred<NoteDTO[]>();
    const duringList = createDeferred<NoteDTO[]>();
    const mutation = createDeferred<NoteDTO>();
    const service = createService();
    service.listNotes
      .mockReturnValueOnce(oldList.promise)
      .mockReturnValueOnce(duringList.promise)
      .mockResolvedValueOnce([firstNote]);
    service.createNote.mockReturnValueOnce(mutation.promise);
    const store = create<NoteSlice>()(createNoteSlice(service));
    const first = store.getState().bootstrapNotes();
    const creating = store.getState().createNote("First");
    const second = store.getState().bootstrapNotes();
    mutation.resolve(firstNote);
    await creating;
    oldList.resolve([]);
    duringList.resolve([]);
    await Promise.all([first, second]);
    expect(store.getState().notes).toEqual([firstNote]);
    expect(store.getState().isNoteBootstrapping).toBe(false);
  });

  test("reset ignores pending mutations and their cleanup in a new lifecycle", async () => {
    const oldMutation = createDeferred<NoteDTO>();
    const newMutation = createDeferred<NoteDTO>();
    const service = createService();
    service.createNote
      .mockReturnValueOnce(oldMutation.promise)
      .mockReturnValueOnce(newMutation.promise);
    const store = create<NoteSlice>()(createNoteSlice(service));
    const old = store.getState().createNote("First");
    store.getState().resetNotes();
    const current = store.getState().createNote("Second");
    oldMutation.resolve(firstNote);
    expect(await old).toBeUndefined();
    expect(store.getState().notes).toEqual([]);
    expect(store.getState().isNoteSubmitting).toBe(true);
    newMutation.resolve(secondNote);
    await current;
    expect(store.getState().notes).toEqual([secondNote]);
  });

  test("closing a detail invalidates its load and AI draft", async () => {
    const detail = createDeferred<NoteDTO>();
    const draft = createDeferred<string>();
    const service = createService();
    service.getNote.mockReturnValueOnce(detail.promise);
    service.refineNote.mockReturnValueOnce(draft.promise);
    const store = create<NoteSlice>()(createNoteSlice(service));
    const loading = store.getState().loadNote("first");
    const refining = store.getState().refineNote("Draft", "Revise");
    store.getState().closeNote();
    detail.resolve(firstNote);
    draft.resolve("Old revision");
    expect(await loading).toBeUndefined();
    expect(await refining).toBeUndefined();
    expect(store.getState().selectedNote).toBeUndefined();
    expect(store.getState().isNoteRefining).toBe(false);
  });
});

describe("Note list and write ordering", () => {
  test.each(["list-first", "write-first", "write-failed"] as const)(
    "retains existing records when the initial load overlaps a create: %s",
    async (order) => {
      const list = createDeferred<NoteDTO[]>();
      const write = createDeferred<NoteDTO>();
      const service = createService();
      service.listNotes
        .mockReturnValueOnce(list.promise)
        .mockResolvedValue([firstNote, secondNote]);
      service.createNote.mockReturnValueOnce(write.promise);
      const store = create<NoteSlice>()(createNoteSlice(service));
      const loading = store.getState().bootstrapNotes();
      const creating = store.getState().createNote("First");
      expect(store.getState().isNoteBootstrapping).toBe(true);
      if (order === "list-first") {
        list.resolve([secondNote]);
        await loading;
      }
      if (order === "write-failed") write.reject(new Error("Write failed"));
      else write.resolve(firstNote);
      await creating;
      if (order !== "list-first") {
        list.resolve([secondNote]);
        await loading;
      }
      if (order === "write-failed") {
        expect(store.getState().notes).toEqual([secondNote]);
        expect(store.getState().noteError).toBe("saving");
      } else expect(store.getState().notes).toEqual([firstNote, secondNote]);
      expect(store.getState().isNoteBootstrapping).toBe(false);
      expect(store.getState().isNoteSubmitting).toBe(false);
    },
  );

  test("refreshes the current search after an earlier create without opening its detail", async () => {
    const write = createDeferred<NoteDTO>();
    const service = createService();
    service.createNote.mockReturnValueOnce(write.promise);
    service.listNotes.mockResolvedValue([secondNote]);
    const store = create<NoteSlice>()(createNoteSlice(service));
    const creating = store.getState().createNote("First");
    await store.getState().bootstrapNotes("Second");
    write.resolve(firstNote);
    expect(await creating).toBeUndefined();
    expect(store.getState().notes).toEqual([secondNote]);
    expect(service.listNotes).toHaveBeenLastCalledWith("Second");
    expect(store.getState().selectedNote).toBeUndefined();
  });
});
