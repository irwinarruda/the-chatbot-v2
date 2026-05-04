import type { StateCreator } from "zustand";
import type { ChatSlice } from "~/client/stores/slices/chatSlice";
import type { PrefsSlice } from "~/client/stores/slices/prefsSlice";

type ComputedSlice = {
  hasChatMessages: boolean;
  canSendChatInput: boolean;
  canSelectAudioInput: boolean;
};

export type AppSlices = ChatSlice & PrefsSlice & ComputedSlice;
export type AppState<T> = StateCreator<AppSlices, [], [], T>;
