import { Database } from "~/infra/database";
import type { CashFlowSpreadsheetGateway } from "~/modules/cash-flow/gateway/CashFlowSpreadsheetGateway";
import { GoogleCashFlowSpreadsheetGateway } from "~/modules/cash-flow/gateway/CashFlowSpreadsheetGateway/GoogleCashFlowSpreadsheetGateway";
import { CashFlowService } from "~/modules/cash-flow/services/CashFlowService";
import { MonthlyExpenseService } from "~/modules/cash-flow/services/MonthlyExpenseService";
import type { AiChatGateway } from "~/modules/chat/gateway/AiChatGateway";
import { PiAiChatGateway } from "~/modules/chat/gateway/AiChatGateway/PiAiChatGateway";
import type { SpeechToTextGateway } from "~/modules/chat/gateway/SpeechToTextGateway";
import { OpenAiSpeechToTextGateway } from "~/modules/chat/gateway/SpeechToTextGateway/OpenAiSpeechToTextGateway";
import type { StorageGateway } from "~/modules/chat/gateway/StorageGateway";
import { R2StorageGateway } from "~/modules/chat/gateway/StorageGateway/R2StorageGateway";
import type { WebMessagingGateway } from "~/modules/chat/gateway/WebMessagingGateway";
import { LocalWebMessagingGateway } from "~/modules/chat/gateway/WebMessagingGateway/LocalWebMessagingGateway";
import type { WhatsAppMessagingGateway } from "~/modules/chat/gateway/WhatsAppMessagingGateway";
import { MetaWhatsAppMessagingGateway } from "~/modules/chat/gateway/WhatsAppMessagingGateway/MetaWhatsAppMessagingGateway";
import { AiToolService } from "~/modules/chat/services/AiToolService";
import { MessagingService } from "~/modules/chat/services/MessagingService";
import type { AuthGateway } from "~/modules/identity/gateway/AuthGateway";
import { GoogleAuthGateway } from "~/modules/identity/gateway/AuthGateway/GoogleAuthGateway";
import {
  AuthService,
  type IdentityChatCoordinator,
} from "~/modules/identity/services/AuthService";
import { GoogleCredentialEncryptionService } from "~/modules/identity/services/GoogleCredentialEncryptionService";
import { MigrationService } from "~/modules/system/services/MigrationService";
import { StatusService } from "~/modules/system/services/StatusService";
import { TodoService } from "~/modules/todos/services/TodoService";
import type { Config } from "~/shared/config/Config";

export interface ApplicationGateways {
  aiChat: AiChatGateway;
  cashFlowSpreadsheet: CashFlowSpreadsheetGateway;
  googleAuth: AuthGateway;
  speechToText: SpeechToTextGateway;
  storage: StorageGateway;
  webMessaging: WebMessagingGateway;
  whatsAppMessaging: WhatsAppMessagingGateway;
}

export interface Application {
  config: Config;
  database: Database;
  gateways: ApplicationGateways;
  coordination: {
    identityChat: IdentityChatCoordinator;
  };
  services: {
    auth: AuthService;
    cashFlow: CashFlowService;
    monthlyExpenses: MonthlyExpenseService;
    messaging: MessagingService;
    migration: MigrationService;
    status: StatusService;
    todos: TodoService;
    tools: AiToolService;
  };
}

export interface ApplicationOverrides {
  database?: Database;
  gateways?: Partial<ApplicationGateways>;
  coordination?: Partial<IdentityChatCoordinator>;
}

export function createApplication(
  config: Config,
  overrides: ApplicationOverrides = {},
): Application {
  const database =
    overrides.database ?? new Database(config.database.connectionString);
  const gateways: ApplicationGateways = {
    aiChat: overrides.gateways?.aiChat ?? new PiAiChatGateway(config.ai),
    cashFlowSpreadsheet:
      overrides.gateways?.cashFlowSpreadsheet ??
      new GoogleCashFlowSpreadsheetGateway(config.google, config.googleSheets),
    googleAuth:
      overrides.gateways?.googleAuth ?? new GoogleAuthGateway(config.google),
    speechToText:
      overrides.gateways?.speechToText ??
      new OpenAiSpeechToTextGateway(config.openAi),
    storage: overrides.gateways?.storage ?? new R2StorageGateway(config.r2),
    webMessaging:
      overrides.gateways?.webMessaging ?? new LocalWebMessagingGateway(),
    whatsAppMessaging:
      overrides.gateways?.whatsAppMessaging ??
      new MetaWhatsAppMessagingGateway(config.whatsApp),
  };
  let messagingService: MessagingService | undefined;
  const defaultChatCoordinator: IdentityChatCoordinator = {
    deleteChat: (channelAddress) =>
      requireMessagingService(messagingService).deleteChat(channelAddress),
    sendSignedInMessage: (channelAddress) =>
      requireMessagingService(messagingService).sendSignedInMessage(
        channelAddress,
      ),
    syncUserChatAddresses: (data) =>
      requireMessagingService(messagingService).syncUserChatAddresses(data),
  };
  const chatCoordinator: IdentityChatCoordinator = {
    ...defaultChatCoordinator,
    ...overrides.coordination,
  };
  const googleCredentialEncryptionService =
    new GoogleCredentialEncryptionService(
      config.googleCredentialEncryption.key,
    );
  const authService = new AuthService(
    database,
    config.jwt,
    gateways.googleAuth,
    googleCredentialEncryptionService,
    chatCoordinator,
  );
  const cashFlowService = new CashFlowService(
    database,
    authService,
    gateways.cashFlowSpreadsheet,
  );
  const monthlyExpenseService = new MonthlyExpenseService(database);
  const todoService = new TodoService(database);
  const aiToolService = new AiToolService(
    authService,
    cashFlowService,
    monthlyExpenseService,
    todoService,
    gateways.aiChat,
  );
  messagingService = new MessagingService(
    database,
    authService,
    gateways.whatsAppMessaging,
    gateways.webMessaging,
    gateways.aiChat,
    aiToolService,
    gateways.storage,
    gateways.speechToText,
    config.ai,
  );
  return {
    config,
    database,
    gateways,
    coordination: { identityChat: chatCoordinator },
    services: {
      auth: authService,
      cashFlow: cashFlowService,
      monthlyExpenses: monthlyExpenseService,
      messaging: messagingService,
      migration: new MigrationService(database, config.database, config.auth),
      status: new StatusService(
        database,
        config.database,
        config.ai,
        config.deployment,
      ),
      todos: todoService,
      tools: aiToolService,
    },
  };
}

function requireMessagingService(
  service: MessagingService | undefined,
): MessagingService {
  if (!service) throw new Error("Messaging service is not composed yet");
  return service;
}
