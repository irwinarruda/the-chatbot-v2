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
import { container } from "~/client/shared/container";

export function bootstrapMockContainer() {
  container.register("SessionRepository", new TestSessionRepository());
  container.register("PrefsGateway", cookiePrefsGateway);
  container.register("MonetaryPrivacyGateway", storageMonetaryPrivacyGateway);
  container.register("CashFlowRepository", new TestCashFlowRepository());
  container.register(
    "MonthlyExpenseRepository",
    new TestMonthlyExpenseRepository(),
  );
  container.register("ChatRepository", new TestChatRepository());
  container.register("AudioInputGateway", browserAudioInputGateway);
  container.register("AudioRecordingGateway", browserAudioRecordingGateway);
  container.register("NoteRepository", new TestNoteRepository());
  container.register("TodoRepository", new TestTodoRepository());
  container.register("ArtifactRepository", new TestArtifactRepository());
}
