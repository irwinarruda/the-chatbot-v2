import { TestArtifactRepository } from "~/client/mock/repositories/TestArtifactRepository";
import { TestCashFlowRepository } from "~/client/mock/repositories/TestCashFlowRepository";
import { TestChatRepository } from "~/client/mock/repositories/TestChatRepository";
import { TestMonthlyExpenseRepository } from "~/client/mock/repositories/TestMonthlyExpenseRepository";
import { TestNoteRepository } from "~/client/mock/repositories/TestNoteRepository";
import { TestSessionRepository } from "~/client/mock/repositories/TestSessionRepository";
import { TestTodoRepository } from "~/client/mock/repositories/TestTodoRepository";
import { browserAudioInputGateway } from "~/client/modules/chat/app/gateways/BrowserAudioInputGateway";
import { browserAudioRecordingGateway } from "~/client/modules/chat/app/gateways/BrowserAudioRecordingGateway";
import { cookiePrefsGateway } from "~/client/shared/app/gateways/CookiePrefsGateway";
import { storageMonetaryPrivacyGateway } from "~/client/shared/app/gateways/StorageMonetaryPrivacyGateway";
import type { AppAdapters } from "~/client/shared/stores/AppAdapters";

export const adapters: AppAdapters = {
  session: new TestSessionRepository(),
  prefs: cookiePrefsGateway,
  privacy: storageMonetaryPrivacyGateway,
  cashFlow: new TestCashFlowRepository(),
  monthlyExpenses: new TestMonthlyExpenseRepository(),
  chat: new TestChatRepository(),
  audioInputs: browserAudioInputGateway,
  audioRecording: browserAudioRecordingGateway,
  notes: new TestNoteRepository(),
  todos: new TestTodoRepository(),
  artifacts: new TestArtifactRepository(),
};
