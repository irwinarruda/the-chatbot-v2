import type { StateCreator } from "zustand";
import { noteService } from "~/modules/notes/client/services/noteService";
import type { NoteDTO } from "~/modules/notes/entities/dtos/NoteDTO";
import { type ApiError, clientError } from "~/shared/client/services/ApiClient";

export type NoteErrorCode = "loading" | "saving" | "deleting" | "refining";

export interface NoteSlice {
  notes: NoteDTO[];
  selectedNote?: NoteDTO;
  isNoteBootstrapping: boolean;
  isNoteSubmitting: boolean;
  isNoteRefining: boolean;
  noteError?: NoteErrorCode | ApiError;
  resetNotes: () => void;
  closeNote: () => void;
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
    let generation = 0;
    let view = 0;
    let listRequest = 0;
    let currentSearch: string | undefined;
    let detailRequest = 0;
    let detailTarget: string | undefined;
    let refineRequest = 0;
    async function reconcileNotes(
      requestGeneration: number,
      previousListRequest: number,
    ) {
      const { isNoteBootstrapping } = get();
      if (!isNoteBootstrapping && listRequest === previousListRequest)
        return false;
      do {
        const { bootstrapNotes } = get();
        await bootstrapNotes(currentSearch);
        const { isNoteBootstrapping } = get();
        if (!isNoteBootstrapping) break;
      } while (requestGeneration === generation);
      return true;
    }
    return {
      notes: [],
      selectedNote: undefined,
      isNoteBootstrapping: false,
      isNoteSubmitting: false,
      isNoteRefining: false,
      noteError: undefined,
      resetNotes() {
        detailTarget = undefined;
        generation += 1;
        listRequest += 1;
        detailRequest += 1;
        view += 1;
        refineRequest += 1;
        set({
          notes: [],
          selectedNote: undefined,
          isNoteBootstrapping: false,
          isNoteSubmitting: false,
          isNoteRefining: false,
          noteError: undefined,
        });
      },
      closeNote() {
        detailTarget = undefined;
        view += 1;
        detailRequest += 1;
        refineRequest += 1;
        set({ selectedNote: undefined, isNoteRefining: false });
      },
      async bootstrapNotes(search) {
        if (currentSearch !== search) view += 1;
        currentSearch = search;
        const request = ++listRequest;
        set({ isNoteBootstrapping: true, noteError: undefined });
        try {
          const notes = await service.listNotes(search);
          if (request === listRequest) set({ notes });
        } catch (error) {
          if (request === listRequest)
            set({ noteError: clientError(error, "loading") });
        } finally {
          if (request === listRequest) set({ isNoteBootstrapping: false });
        }
      },
      async createNote(name) {
        const { isNoteSubmitting } = get();
        const normalizedName = name.trim();
        if (!normalizedName || isNoteSubmitting) return undefined;
        const requestGeneration = generation;
        const previousListRequest = listRequest;
        const requestView = view;
        set({ isNoteSubmitting: true, noteError: undefined });
        try {
          const note = await service.createNote({ name: normalizedName });
          if (requestGeneration !== generation) return undefined;
          const refreshed = await reconcileNotes(
            requestGeneration,
            previousListRequest,
          );
          if (requestGeneration !== generation) return undefined;
          if (requestView === view) {
            detailRequest += 1;
            detailTarget = note.id;
          }
          set((state) => {
            let selectedNote = state.selectedNote;
            if (requestView === view) selectedNote = note;
            let notes = state.notes;
            if (!refreshed)
              notes = [note, ...notes.filter((item) => item.id !== note.id)];
            return { notes, selectedNote };
          });
          if (requestView !== view) return undefined;
          return note;
        } catch (error) {
          if (requestGeneration !== generation) return undefined;
          set({ noteError: clientError(error, "saving") });
          return undefined;
        } finally {
          if (requestGeneration === generation)
            set({ isNoteSubmitting: false });
        }
      },
      async loadNote(id) {
        detailTarget = id;
        view += 1;
        refineRequest += 1;
        set({ isNoteRefining: false });
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
        } catch (error) {
          if (request === detailRequest) {
            set({
              noteError: clientError(error, "loading"),
              selectedNote: undefined,
            });
          }
          return undefined;
        }
      },
      async updateNote(id, patch) {
        const { isNoteSubmitting } = get();
        if (isNoteSubmitting) return undefined;
        const requestGeneration = generation;
        const previousListRequest = listRequest;
        const requestView = view;
        set({ isNoteSubmitting: true, noteError: undefined });
        try {
          const note = await service.updateNote(id, patch);
          if (requestGeneration !== generation) return undefined;
          const refreshed = await reconcileNotes(
            requestGeneration,
            previousListRequest,
          );
          if (requestGeneration !== generation) return undefined;
          if (detailTarget === id) detailRequest += 1;
          set((state) => {
            let selectedNote = state.selectedNote;
            if (selectedNote?.id === id || detailTarget === id)
              selectedNote = note;
            let notes = state.notes;
            if (!refreshed)
              notes = state.notes
                .map((item) => {
                  if (item.id === id) return note;
                  return item;
                })
                .sort((left, right) =>
                  right.updatedAt.localeCompare(left.updatedAt),
                );
            return {
              notes,
              selectedNote,
            };
          });
          if (requestView !== view) return undefined;
          return note;
        } catch (error) {
          if (requestGeneration !== generation) return undefined;
          set({ noteError: clientError(error, "saving") });
          return undefined;
        } finally {
          if (requestGeneration === generation)
            set({ isNoteSubmitting: false });
        }
      },
      async deleteNote(id) {
        const { isNoteSubmitting } = get();
        if (isNoteSubmitting) return false;
        const requestGeneration = generation;
        const previousListRequest = listRequest;
        const requestView = view;
        set({ isNoteSubmitting: true, noteError: undefined });
        try {
          await service.deleteNote(id);
          if (requestGeneration !== generation) return false;
          const refreshed = await reconcileNotes(
            requestGeneration,
            previousListRequest,
          );
          if (requestGeneration !== generation) return false;
          if (detailTarget === id) detailRequest += 1;
          set((state) => {
            let selectedNote = state.selectedNote;
            if (selectedNote?.id === id || detailTarget === id)
              selectedNote = undefined;
            let notes = state.notes;
            if (!refreshed)
              notes = state.notes.filter((note) => note.id !== id);
            return {
              notes,
              selectedNote,
            };
          });
          return requestView === view;
        } catch (error) {
          if (requestGeneration !== generation) return false;
          set({ noteError: clientError(error, "deleting") });
          return false;
        } finally {
          if (requestGeneration === generation)
            set({ isNoteSubmitting: false });
        }
      },
      async refineNote(markdown, instruction) {
        const { isNoteRefining } = get();
        if (!instruction.trim() || isNoteRefining) return undefined;
        const request = ++refineRequest;
        set({ isNoteRefining: true, noteError: undefined });
        try {
          const result = await service.refineNote({ markdown, instruction });
          if (request !== refineRequest) return undefined;
          return result;
        } catch (error) {
          if (request !== refineRequest) return undefined;
          set({ noteError: clientError(error, "refining") });
          return undefined;
        } finally {
          if (request === refineRequest) set({ isNoteRefining: false });
        }
      },
      clearNoteError() {
        set({ noteError: undefined });
      },
    };
  };
}

export const noteSlice = createNoteSlice();
