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
});
