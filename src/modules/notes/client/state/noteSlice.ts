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

export function createNoteSlice(
  service: typeof noteService = noteService,
): StateCreator<NoteSlice> {
  return (set, get) => {
    let listRequest = 0;
    let detailRequest = 0;
    return {
      notes: [],
      selectedNote: undefined,
      isNoteBootstrapping: false,
      isNoteSubmitting: false,
      isNoteRefining: false,
      noteError: undefined,
      async bootstrapNotes(search) {
        const request = ++listRequest;
        set({ isNoteBootstrapping: true, noteError: undefined });
        try {
          const notes = await service.listNotes(search);
          if (request === listRequest) set({ notes });
        } catch {
          if (request === listRequest) set({ noteError: "loading" });
        } finally {
          if (request === listRequest) set({ isNoteBootstrapping: false });
        }
      },
      async createNote(name) {
        const { isNoteSubmitting } = get();
        const normalizedName = name.trim();
        if (!normalizedName || isNoteSubmitting) return undefined;
        set({ isNoteSubmitting: true, noteError: undefined });
        try {
          const note = await service.createNote({ name: normalizedName });
          set((state) => ({
            notes: [note, ...state.notes],
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
      async loadNote(id) {
        const request = ++detailRequest;
        const { notes } = get();
        const existing = notes.find((note) => note.id === id);
        if (existing) {
          set({ selectedNote: existing });
          return existing;
        }
        set({ noteError: undefined, selectedNote: undefined });
        try {
          const note = await service.getNote(id);
          if (request !== detailRequest) return undefined;
          set({ selectedNote: note });
          return note;
        } catch {
          if (request === detailRequest) {
            set({ noteError: "loading", selectedNote: undefined });
          }
          return undefined;
        }
      },
      async updateNote(id, patch) {
        const { isNoteSubmitting } = get();
        if (isNoteSubmitting) return undefined;
        set({ isNoteSubmitting: true, noteError: undefined });
        try {
          const note = await service.updateNote(id, patch);
          set((state) => {
            let selectedNote = state.selectedNote;
            if (selectedNote?.id === id) selectedNote = note;
            return {
              notes: state.notes
                .map((item) => {
                  if (item.id === id) return note;
                  return item;
                })
                .sort((left, right) =>
                  right.updatedAt.localeCompare(left.updatedAt),
                ),
              selectedNote,
            };
          });
          return note;
        } catch {
          set({ noteError: "saving" });
          return undefined;
        } finally {
          set({ isNoteSubmitting: false });
        }
      },
      async deleteNote(id) {
        const { isNoteSubmitting } = get();
        if (isNoteSubmitting) return false;
        set({ isNoteSubmitting: true, noteError: undefined });
        try {
          await service.deleteNote(id);
          set((state) => {
            let selectedNote = state.selectedNote;
            if (selectedNote?.id === id) selectedNote = undefined;
            return {
              notes: state.notes.filter((note) => note.id !== id),
              selectedNote,
            };
          });
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
          return await service.refineNote({ markdown, instruction });
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
    };
  };
}

export const noteSlice = createNoteSlice();
