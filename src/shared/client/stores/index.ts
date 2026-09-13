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
  createSessionSlice,
  type SessionSlice,
} from "~/modules/identity/client/state/sessionSlice";
import {
  type NoteSlice,
  noteSlice,
} from "~/modules/notes/client/state/noteSlice";
import {
  type TodoSlice,
  todoSlice,
} from "~/modules/todos/client/state/todoSlice";
import { apiClient } from "~/shared/client/services/ApiClient";
import {
  type PrefsSlice,
  prefsSlice,
} from "~/shared/client/stores/slices/prefsSlice";
import {
  type PrivacySlice,
  privacySlice,
} from "~/shared/client/stores/slices/privacySlice";

export type AppSlices = SessionSlice &
  CashFlowSlice &
  ChatSlice &
  MonthlyExpenseSlice &
  RecordingSlice &
  PrefsSlice &
  PrivacySlice &
  NoteSlice &
  TodoSlice;

export const useApp = create<AppSlices>()(
  computed((...args) => ({
    ...createSessionSlice(() => {
      const {
        resetRecording,
        resetChat,
        resetNotes,
        resetTodos,
        resetCashFlow,
        resetMonthlyExpenses,
      } = args[1]();
      resetRecording();
      resetChat();
      resetNotes();
      resetTodos();
      resetCashFlow();
      resetMonthlyExpenses();
    })(...args),
    ...prefsSlice(...args),
    ...privacySlice(...args),
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
  PrivacySlice,
  RecordingSlice,
  TodoSlice,
};

apiClient.onUnauthorized = () => {
  const { expireSession } = useApp.getState();
  expireSession();
};
