import type { StateCreator } from "zustand";
import { noteService } from "~/modules/notes/client/services/noteService";
import type { NoteDTO } from "~/modules/notes/entities/dtos/NoteDTO";

export type NoteErrorCode = "loading" | "saving" | "deleting" | "refining";

export interface NoteSlice {
  notes: NoteDTO[];
  selectedNote?: NoteDTO;
  isNoteBootstrapping: boolean;
  isNoteSubmitting: boolean;
  isNoteRefining: boolean;
  noteError?: NoteErrorCode;
  bootstrapNotes: (search?: string) => Promise<void>;
  createNote: (name: string) => Promise<NoteDTO | undefined>;
  loadNote: (id: string) => Promise<NoteDTO | undefined>;
  updateNote: (
    id: string,
    patch: { name?: string; markdown?: string },
  ) => Promise<NoteDTO | undefined>;
  deleteNote: (id: string) => Promise<boolean>;
  refineNote: (
    markdown: string,
    instruction: string,
  ) => Promise<string | undefined>;
  clearNoteError: () => void;
}

export const noteSlice: StateCreator<NoteSlice> = (set, get) => ({
  notes: [],
  selectedNote: undefined,
  isNoteBootstrapping: false,
  isNoteSubmitting: false,
  isNoteRefining: false,
  noteError: undefined,
  async bootstrapNotes(search) {
    set({ isNoteBootstrapping: true, noteError: undefined });
    try {
      const notes = await noteService.listNotes(search);
      set({ notes });
    } catch {
      set({ noteError: "loading" });
    } finally {
      set({ isNoteBootstrapping: false });
    }
  },
  async createNote(name) {
    const { isNoteSubmitting } = get();
    const normalizedName = name.trim();
    if (!normalizedName || isNoteSubmitting) return undefined;
    set({ isNoteSubmitting: true, noteError: undefined });
    try {
      const note = await noteService.createNote({ name: normalizedName });
      set((state) => ({ notes: [note, ...state.notes], selectedNote: note }));
      return note;
    } catch {
      set({ noteError: "saving" });
      return undefined;
    } finally {
      set({ isNoteSubmitting: false });
    }
  },
  async loadNote(id) {
    const { notes } = get();
    const existing = notes.find((note) => note.id === id);
    if (existing) {
      set({ selectedNote: existing });
      return existing;
    }
    set({ noteError: undefined });
    try {
      const note = await noteService.getNote(id);
      set({ selectedNote: note });
      return note;
    } catch {
      set({ noteError: "loading", selectedNote: undefined });
      return undefined;
    }
  },
  async updateNote(id, patch) {
    const { isNoteSubmitting } = get();
    if (isNoteSubmitting) return undefined;
    set({ isNoteSubmitting: true, noteError: undefined });
    try {
      const note = await noteService.updateNote(id, patch);
      set((state) => ({
        notes: state.notes
          .map((item) => {
            if (item.id === id) return note;
            return item;
          })
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
        selectedNote: note,
      }));
      return note;
    } catch {
      set({ noteError: "saving" });
      return undefined;
    } finally {
      set({ isNoteSubmitting: false });
    }
  },
  async deleteNote(id) {
    set({ isNoteSubmitting: true, noteError: undefined });
    try {
      await noteService.deleteNote(id);
      set((state) => ({
        notes: state.notes.filter((note) => note.id !== id),
        selectedNote: undefined,
      }));
      return true;
    } catch {
      set({ noteError: "deleting" });
      return false;
    } finally {
      set({ isNoteSubmitting: false });
    }
  },
  async refineNote(markdown, instruction) {
    const { isNoteRefining } = get();
    if (!instruction.trim() || isNoteRefining) return undefined;
    set({ isNoteRefining: true, noteError: undefined });
    try {
      return await noteService.refineNote({ markdown, instruction });
    } catch {
      set({ noteError: "refining" });
      return undefined;
    } finally {
      set({ isNoteRefining: false });
    }
  },
  clearNoteError() {
    set({ noteError: undefined });
  },
});
