import { create } from "zustand";
import { computed } from "zustand-computed-state";
import { apiArtifactRepository } from "~/client/modules/artifacts/app/repositories/ApiArtifactRepository";
import {
  type ArtifactService,
  createArtifactService,
} from "~/client/modules/artifacts/app/services/ArtifactService";
import { apiCashFlowRepository } from "~/client/modules/cash-flow/app/repositories/ApiCashFlowRepository";
import { apiMonthlyExpenseRepository } from "~/client/modules/cash-flow/app/repositories/ApiMonthlyExpenseRepository";
import {
  type CashFlowService,
  createCashFlowService,
} from "~/client/modules/cash-flow/app/services/CashFlowService";
import {
  createMonthlyExpenseService,
  type MonthlyExpenseService,
} from "~/client/modules/cash-flow/app/services/MonthlyExpenseService";
import { browserAudioInputGateway } from "~/client/modules/chat/app/gateways/BrowserAudioInputGateway";
import { browserAudioRecordingGateway } from "~/client/modules/chat/app/gateways/BrowserAudioRecordingGateway";
import { apiChatRepository } from "~/client/modules/chat/app/repositories/ApiChatRepository";
import {
  type ChatService,
  createChatService,
} from "~/client/modules/chat/app/services/ChatService";
import {
  createRecordingService,
  type RecordingService,
} from "~/client/modules/chat/app/services/RecordingService";
import { apiSessionRepository } from "~/client/modules/identity/app/repositories/ApiSessionRepository";
import {
  createSessionService,
  type SessionService,
} from "~/client/modules/identity/app/services/SessionService";
import { apiNoteRepository } from "~/client/modules/notes/app/repositories/ApiNoteRepository";
import {
  createNoteService,
  type NoteService,
} from "~/client/modules/notes/app/services/NoteService";
import { apiTodoRepository } from "~/client/modules/todos/app/repositories/ApiTodoRepository";
import {
  createTodoService,
  type TodoService,
} from "~/client/modules/todos/app/services/TodoService";
import { apiClient } from "~/client/shared/app/gateways/ApiClient";
import { cookiePrefsGateway } from "~/client/shared/app/gateways/CookiePrefsGateway";
import { storageMonetaryPrivacyGateway } from "~/client/shared/app/gateways/StorageMonetaryPrivacyGateway";
import {
  createPrefsService,
  type PrefsService,
} from "~/client/shared/app/services/PrefsService";
import {
  createPrivacyService,
  type PrivacyService,
} from "~/client/shared/app/services/PrivacyService";
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
      createSessionService(resetFeatures, apiSessionRepository)(...args),
      createPrefsService(cookiePrefsGateway)(...args),
      createPrivacyService(storageMonetaryPrivacyGateway)(...args),
      createCashFlowService(apiCashFlowRepository)(...args),
      createMonthlyExpenseService(apiMonthlyExpenseRepository)(...args),
      createChatService(apiChatRepository)(...args),
      createRecordingService(
        browserAudioInputGateway,
        browserAudioRecordingGateway,
      )(...args),
      createNoteService(apiNoteRepository)(...args),
      createTodoService(apiTodoRepository)(...args),
      createArtifactService(apiArtifactRepository)(...args),
    );
  }),
);

apiClient.onUnauthorized = () => {
  const { expireSession } = useApp.getState();
  expireSession();
};
