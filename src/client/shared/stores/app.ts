import { create } from "zustand";
import { computed } from "zustand-computed-state";
import {
  type ArtifactService,
  createArtifactService,
} from "~/client/modules/artifacts/app/services/ArtifactService";
import {
  type CashFlowService,
  createCashFlowService,
} from "~/client/modules/cash-flow/app/services/CashFlowService";
import {
  createMonthlyExpenseService,
  type MonthlyExpenseService,
} from "~/client/modules/cash-flow/app/services/MonthlyExpenseService";
import {
  type ChatService,
  createChatService,
} from "~/client/modules/chat/app/services/ChatService";
import {
  createRecordingService,
  type RecordingService,
} from "~/client/modules/chat/app/services/RecordingService";
import {
  createSessionService,
  type SessionService,
} from "~/client/modules/identity/app/services/SessionService";
import {
  createNoteService,
  type NoteService,
} from "~/client/modules/notes/app/services/NoteService";
import {
  createTodoService,
  type TodoService,
} from "~/client/modules/todos/app/services/TodoService";
import { apiClient } from "~/client/shared/app/gateways/ApiClient";
import {
  createPrefsService,
  type PrefsService,
} from "~/client/shared/app/services/PrefsService";
import {
  createPrivacyService,
  type PrivacyService,
} from "~/client/shared/app/services/PrivacyService";
import { adapters } from "~/client/shared/stores/adapters";
import { composeServices } from "~/client/shared/stores/composeServices";

export type AppServices = SessionService &
  ArtifactService &
  CashFlowService &
  ChatService &
  MonthlyExpenseService &
  RecordingService &
  PrefsService &
  PrivacyService &
  NoteService &
  TodoService;

export const useApp = create<AppServices>()(
  computed((...args) => {
    const [, get] = args;
    function resetFeatures() {
      const {
        resetRecording,
        resetChat,
        resetNotes,
        resetTodos,
        resetCashFlow,
        resetMonthlyExpenses,
        resetArtifacts,
      } = get();
      resetRecording();
      resetChat();
      resetNotes();
      resetTodos();
      resetCashFlow();
      resetMonthlyExpenses();
      resetArtifacts();
    }
    return composeServices(
      createSessionService(resetFeatures, adapters.session)(...args),
      createPrefsService(adapters.prefs)(...args),
      createPrivacyService(adapters.privacy)(...args),
      createCashFlowService(adapters.cashFlow)(...args),
      createMonthlyExpenseService(adapters.monthlyExpenses)(...args),
      createChatService(adapters.chat)(...args),
      createRecordingService(
        adapters.audioInputs,
        adapters.audioRecording,
      )(...args),
      createNoteService(adapters.notes)(...args),
      createTodoService(adapters.todos)(...args),
      createArtifactService(adapters.artifacts)(...args),
    );
  }),
);

apiClient.onUnauthorized = () => {
  const { expireSession } = useApp.getState();
  expireSession();
};
