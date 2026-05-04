import { create } from "zustand";
import { compute, computed } from "zustand-computed-state";
import { type ChatSlice, chatSlice } from "~/client/stores/slices/chatSlice";
import { type PrefsSlice, prefsSlice } from "~/client/stores/slices/prefsSlice";
import type { AppSlices } from "~/client/stores/types";

export type { AppState } from "~/client/stores/types";
export type { AppSlices };

export const useApp = create<AppSlices>()(
  computed((set, get, api) => ({
    ...prefsSlice(set, get, api),
    ...chatSlice(set, get, api),
    ...compute(get, (state) => ({
      hasChatMessages: state.chatMessages.length > 0,
      canSendChatInput:
        state.chatInput.trim().length > 0 && !state.isChatSubmitting,
      canSelectAudioInput:
        state.audioInputOptions.length >= 2 &&
        !state.isChatSubmitting &&
        !state.isRecording,
    })),
  })),
);

export type { ChatSlice, PrefsSlice };
