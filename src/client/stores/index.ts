import type { StateCreator } from "zustand";
import { create } from "zustand";
import { computed } from "zustand-computed-state";
import { type ChatSlice, chatSlice } from "~/client/stores/slices/chatSlice";
import { type PrefsSlice, prefsSlice } from "~/client/stores/slices/prefsSlice";
import { type TodoSlice, todoSlice } from "~/client/stores/slices/todoSlice";

export type AppSlices = ChatSlice & PrefsSlice & TodoSlice;
export type AppState<T> = StateCreator<AppSlices, [], [], T>;

export const useApp = create<AppSlices>()(
  computed((...args) => ({
    ...prefsSlice(...args),
    ...chatSlice(...args),
    ...todoSlice(...args),
  })),
);

export type { ChatSlice, PrefsSlice, TodoSlice };
