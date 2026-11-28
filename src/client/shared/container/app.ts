import { apiArtifactRepository } from "~/client/modules/artifacts/app/repositories/ApiArtifactRepository";
import { browserSpreadsheetPickerGateway } from "~/client/modules/cash-flow/app/gateways/BrowserSpreadsheetPickerGateway";
import { apiCashFlowRepository } from "~/client/modules/cash-flow/app/repositories/ApiCashFlowRepository";
import { apiMonthlyExpenseRepository } from "~/client/modules/cash-flow/app/repositories/ApiMonthlyExpenseRepository";
import { browserAudioInputGateway } from "~/client/modules/chat/app/gateways/BrowserAudioInputGateway";
import { browserAudioRecordingGateway } from "~/client/modules/chat/app/gateways/BrowserAudioRecordingGateway";
import { apiChatRepository } from "~/client/modules/chat/app/repositories/ApiChatRepository";
import { apiSessionRepository } from "~/client/modules/identity/app/repositories/ApiSessionRepository";
import { apiOAuthConsentRepository } from "~/client/modules/mcp/app/repositories/ApiOAuthConsentRepository";
import { apiNoteRepository } from "~/client/modules/notes/app/repositories/ApiNoteRepository";
import { apiTodoRepository } from "~/client/modules/todos/app/repositories/ApiTodoRepository";
import { cookiePrefsGateway } from "~/client/shared/app/gateways/CookiePrefsGateway";
import { storageMonetaryPrivacyGateway } from "~/client/shared/app/gateways/StorageMonetaryPrivacyGateway";
import { container } from "~/client/shared/container";

export function bootstrapAppContainer() {
  container.register("SessionRepository", apiSessionRepository);
  container.register("PrefsGateway", cookiePrefsGateway);
  container.register("MonetaryPrivacyGateway", storageMonetaryPrivacyGateway);
  container.register("CashFlowRepository", apiCashFlowRepository);
  container.register(
    "SpreadsheetPickerGateway",
    browserSpreadsheetPickerGateway,
  );
  container.register("MonthlyExpenseRepository", apiMonthlyExpenseRepository);
  container.register("ChatRepository", apiChatRepository);
  container.register("AudioInputGateway", browserAudioInputGateway);
  container.register("AudioRecordingGateway", browserAudioRecordingGateway);
  container.register("NoteRepository", apiNoteRepository);
  container.register("TodoRepository", apiTodoRepository);
  container.register("ArtifactRepository", apiArtifactRepository);
  container.register("OAuthConsentRepository", apiOAuthConsentRepository);
}
