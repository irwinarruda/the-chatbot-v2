import type { StateCreator } from "zustand";
import { create } from "zustand";
import { computed } from "zustand-computed-state";
import { type PrefsSlice, prefsSlice } from "~/client/stores/slices/prefsSlice";
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

export type AppSlices = ChatSlice & RecordingSlice & PrefsSlice & TodoSlice;
export type AppState<T> = StateCreator<AppSlices, [], [], T>;

export const useApp = create<AppSlices>()(
  computed((...args) => ({
    ...prefsSlice(...args),
    ...chatSlice(...args),
    ...recordingSlice(...args),
    ...todoSlice(...args),
  })),
);

export type { ChatSlice, PrefsSlice, RecordingSlice, TodoSlice };
