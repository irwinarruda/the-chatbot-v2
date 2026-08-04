import { create } from "zustand";
import { computed } from "zustand-computed-state";
import {
  type CashFlowSlice,
  cashFlowSlice,
} from "~/modules/cash-flow/client/state/cashFlowSlice";
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

export type AppSlices = CashFlowSlice &
  ChatSlice &
  MonthlyExpenseSlice &
  RecordingSlice &
  PrefsSlice &
  NoteSlice &
  TodoSlice;

export const useApp = create<AppSlices>()(
  computed((...args) => ({
    ...prefsSlice(...args),
    ...cashFlowSlice(...args),
    ...monthlyExpenseSlice(...args),
    ...chatSlice(...args),
    ...recordingSlice(...args),
    ...noteSlice(...args),
    ...todoSlice(...args),
  })),
);

export type {
  CashFlowSlice,
  ChatSlice,
  MonthlyExpenseSlice,
  NoteSlice,
  PrefsSlice,
  RecordingSlice,
  TodoSlice,
};
