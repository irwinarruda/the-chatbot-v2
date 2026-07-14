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
  TodoSlice;

export const useApp = create<AppSlices>()(
  computed((...args) => ({
    ...prefsSlice(...args),
    ...monthlyExpenseSlice(...args),
    ...chatSlice(...args),
    ...recordingSlice(...args),
    ...todoSlice(...args),
  })),
);

export type {
  ChatSlice,
  MonthlyExpenseSlice,
  PrefsSlice,
  RecordingSlice,
  TodoSlice,
};
