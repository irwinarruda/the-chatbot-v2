import { create } from "zustand";
import { computed } from "zustand-computed-state";
import {
  type MonthlyExpenseSlice,
  monthlyExpenseSlice,
} from "~/modules/cash-flow/client/state/monthlyExpenseSlice";
import {
  type ChatSlice,
  chatSlice,
} from "~/modules/chat/client/state/chatSlice";
import {
  type RecordingSlice,
  recordingSlice,
} from "~/modules/chat/client/state/recordingSlice";
import {
  type NoteSlice,
  noteSlice,
} from "~/modules/notes/client/state/noteSlice";
import {
  type TodoSlice,
  todoSlice,
} from "~/modules/todos/client/state/todoSlice";
import {
  type PrefsSlice,
  prefsSlice,
} from "~/shared/client/stores/slices/prefsSlice";

export type AppSlices = ChatSlice &
  MonthlyExpenseSlice &
  RecordingSlice &
  PrefsSlice &
  NoteSlice &
  TodoSlice;

export const useApp = create<AppSlices>()(
  computed((...args) => ({
    ...prefsSlice(...args),
    ...monthlyExpenseSlice(...args),
    ...chatSlice(...args),
    ...recordingSlice(...args),
    ...noteSlice(...args),
    ...todoSlice(...args),
  })),
);

export type {
  ChatSlice,
  MonthlyExpenseSlice,
  NoteSlice,
  PrefsSlice,
  RecordingSlice,
  TodoSlice,
};
