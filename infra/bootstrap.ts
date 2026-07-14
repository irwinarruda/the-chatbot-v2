import { Database } from "~/infra/database";
import { CashFlowService } from "~/modules/cash-flow/application/CashFlowService";
import { MonthlyExpenseService } from "~/modules/cash-flow/application/MonthlyExpenseService";
import type { ICashFlowSpreadsheetGateway } from "~/modules/cash-flow/application/ports/ICashFlowSpreadsheetGateway";
import { GoogleCashFlowSpreadsheetGateway } from "~/modules/cash-flow/server/GoogleCashFlowSpreadsheetGateway";
import { AiToolService } from "~/modules/chat/application/AiToolService";
import { MessagingService } from "~/modules/chat/application/MessagingService";
import type { IAiChatGateway } from "~/modules/chat/application/ports/IAiChatGateway";
import type { ISpeechToTextGateway } from "~/modules/chat/application/ports/ISpeechToTextGateway";
import type { IStorageGateway } from "~/modules/chat/application/ports/IStorageGateway";
import type { IWebMessagingGateway } from "~/modules/chat/application/ports/IWebMessagingGateway";
import type { IWhatsAppMessagingGateway } from "~/modules/chat/application/ports/IWhatsAppMessagingGateway";
import { OpenAiSpeechToTextGateway } from "~/modules/chat/server/OpenAiSpeechToTextGateway";
import { PiAiChatGateway } from "~/modules/chat/server/PiAiChatGateway";
import { R2StorageGateway } from "~/modules/chat/server/R2StorageGateway";
import { WebMessagingGateway } from "~/modules/chat/server/WebMessagingGateway";
import { WhatsAppMessagingGateway } from "~/modules/chat/server/WhatsAppMessagingGateway";
import {
  AuthService,
  type IdentityChatCoordinator,
} from "~/modules/identity/application/AuthService";
import type { IGoogleAuthGateway } from "~/modules/identity/application/ports/IGoogleAuthGateway";
import { GoogleAuthGateway } from "~/modules/identity/server/GoogleAuthGateway";
import { StatusService } from "~/modules/system/application/StatusService";
import { MigrationService } from "~/modules/system/server/MigrationService";
import { TodoService } from "~/modules/todos/application/TodoService";
import type { Config } from "~/shared/server/Config";

export interface ApplicationGateways {
  aiChat: IAiChatGateway;
  cashFlowSpreadsheet: ICashFlowSpreadsheetGateway;
  googleAuth: IGoogleAuthGateway;
  speechToText: ISpeechToTextGateway;
  storage: IStorageGateway;
  webMessaging: IWebMessagingGateway;
  whatsAppMessaging: IWhatsAppMessagingGateway;
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
    webMessaging: overrides.gateways?.webMessaging ?? new WebMessagingGateway(),
    whatsAppMessaging:
      overrides.gateways?.whatsAppMessaging ??
      new WhatsAppMessagingGateway(config.whatsApp),
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
  const authService = new AuthService(
    database,
    config.encryption,
    config.jwt,
    gateways.googleAuth,
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
      status: new StatusService(database, config.database, config.ai),
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
