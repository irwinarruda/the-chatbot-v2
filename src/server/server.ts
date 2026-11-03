import { createAccountTools } from "~/server/modules/accounts/controllers/accounts.tools";
import { AccountsService } from "~/server/modules/accounts/services/accounts.service";
import { ArtifactRepository } from "~/server/modules/artifacts/repositories/artifact.repository";
import { ArtifactUploadTokenRepository } from "~/server/modules/artifacts/repositories/artifact-upload-token.repository";
import { ArtifactService } from "~/server/modules/artifacts/services/artifact.service";
import { createCashFlowTools } from "~/server/modules/cash-flow/controllers/cash-flow.tools";
import type { CashFlowSpreadsheetGateway } from "~/server/modules/cash-flow/gateways/cash-flow-spreadsheet";
import { CashFlowSpreadsheetRepository } from "~/server/modules/cash-flow/repositories/cash-flow-spreadsheet.repository";
import { MonthlyExpenseRepository } from "~/server/modules/cash-flow/repositories/monthly-expense.repository";
import { CashFlowService } from "~/server/modules/cash-flow/services/cash-flow.service";
import { MonthlyExpenseService } from "~/server/modules/cash-flow/services/monthly-expense.service";
import { MonthlyExpensePaymentService } from "~/server/modules/cash-flow/services/monthly-expense-payment.service";
import { TransactionClassifierService } from "~/server/modules/cash-flow/services/transaction-classifier.service";
import { TransactionEntryService } from "~/server/modules/cash-flow/services/transaction-entry.service";
import { createChatTools } from "~/server/modules/chat/controllers/chat.tools";
import type { AiChatGateway } from "~/server/modules/chat/gateways/ai-chat";
import type { SpeechToTextGateway } from "~/server/modules/chat/gateways/speech-to-text";
import type { StorageGateway } from "~/server/modules/chat/gateways/storage";
import type { WebMessagingGateway } from "~/server/modules/chat/gateways/web-messaging";
import type { WhatsAppMessagingGateway } from "~/server/modules/chat/gateways/whatsapp-messaging";
import { AiModelPreferenceRepository } from "~/server/modules/chat/repositories/ai-model-preference.repository";
import { ChatRepository } from "~/server/modules/chat/repositories/chat.repository";
import { AiAgentService } from "~/server/modules/chat/services/ai-agent.service";
import { AiModelService } from "~/server/modules/chat/services/ai-model.service";
import { ChatCommandService } from "~/server/modules/chat/services/chat-command.service";
import { ChatContextService } from "~/server/modules/chat/services/chat-context.service";
import { ChatDeliveryService } from "~/server/modules/chat/services/chat-delivery.service";
import { MessagingService } from "~/server/modules/chat/services/messaging.service";
import { ToolExecutor } from "~/server/modules/chat/services/tool-executor.service";
import type { AuthGateway } from "~/server/modules/identity/gateways/auth";
import { GoogleAuthChallengeRepository } from "~/server/modules/identity/repositories/google-auth-challenge.repository";
import { UserRepository } from "~/server/modules/identity/repositories/user.repository";
import { AuthService } from "~/server/modules/identity/services/auth.service";
import { GoogleCredentialEncryptionService } from "~/server/modules/identity/utils/google-credential-encryption";
import { createNoteTools } from "~/server/modules/notes/controllers/notes.tools";
import { NoteRepository } from "~/server/modules/notes/repositories/note.repository";
import { NoteService } from "~/server/modules/notes/services/note.service";
import type { MigrationsGateway } from "~/server/modules/system/gateways/migrations";
import { DatabaseStatusRepository } from "~/server/modules/system/repositories/database-status.repository";
import { MigrationService } from "~/server/modules/system/services/migration.service";
import { StatusService } from "~/server/modules/system/services/status.service";
import { createTodoTools } from "~/server/modules/todos/controllers/todos.tools";
import { TodoRepository } from "~/server/modules/todos/repositories/todo.repository";
import { TodoService } from "~/server/modules/todos/services/todo.service";
import type { Config } from "~/server/shared/config/config";
import type { DatabaseGateway } from "~/server/shared/database/database";

export interface ServerGateways {
  database: DatabaseGateway;
  aiChat: AiChatGateway;
  cashFlowSpreadsheet: CashFlowSpreadsheetGateway;
  googleAuth: AuthGateway;
  migrations: MigrationsGateway;
  speechToText: SpeechToTextGateway;
  storage: StorageGateway;
  webMessaging: WebMessagingGateway;
  whatsAppMessaging: WhatsAppMessagingGateway;
}

export interface ServerOptions {
  isDevelopment: boolean;
  clock?: () => Date;
}

export type Server = ReturnType<typeof createServer>;

export function createServer(
  config: Config,
  gateways: ServerGateways,
  options: ServerOptions,
) {
  const {
    database,
    aiChat,
    cashFlowSpreadsheet,
    googleAuth,
    migrations,
    speechToText,
    storage,
    webMessaging,
    whatsAppMessaging,
  } = gateways;
  const { isDevelopment, clock } = options;
  const users = new UserRepository(
    database,
    new GoogleCredentialEncryptionService(config.credentialEncryption.key),
  );
  const auth = new AuthService(
    database,
    users,
    new GoogleAuthChallengeRepository(database),
    config.jwt,
    googleAuth,
  );
  const chats = new ChatRepository(database);
  const aiModels = new AiModelService(
    new AiModelPreferenceRepository(database),
    aiChat,
  );
  const delivery = new ChatDeliveryService(
    chats,
    whatsAppMessaging,
    webMessaging,
  );
  const context = new ChatContextService(chats, aiChat);
  const accounts = new AccountsService(auth, chats, delivery);
  const todos = new TodoService(new TodoRepository(database), chats);
  const notes = new NoteService(new NoteRepository(database), aiModels);
  const monthlyExpenses = new MonthlyExpenseService(
    new MonthlyExpenseRepository(database),
  );
  const cashFlow = new CashFlowService(
    new CashFlowSpreadsheetRepository(database),
    auth,
    cashFlowSpreadsheet,
  );
  const tools = new ToolExecutor([
    ...createChatTools(clock),
    ...createCashFlowTools(
      auth,
      cashFlow,
      monthlyExpenses,
      new TransactionEntryService(
        cashFlow,
        monthlyExpenses,
        new TransactionClassifierService(aiChat),
      ),
    ),
    ...createTodoTools(auth, todos),
    ...createNoteTools(auth, notes),
    ...createAccountTools(auth, accounts),
  ]);
  const commands = new ChatCommandService(
    database,
    chats,
    delivery,
    context,
    aiModels,
    aiChat,
  );
  const agent = new AiAgentService(
    database,
    chats,
    delivery,
    context,
    aiModels,
    aiChat,
    tools,
  );
  const messaging = new MessagingService(
    database,
    chats,
    delivery,
    commands,
    agent,
    auth,
    whatsAppMessaging,
    webMessaging,
    aiChat,
    aiModels,
    storage,
    speechToText,
    isDevelopment,
  );
  return {
    config,
    services: {
      accounts,
      artifacts: new ArtifactService(
        new ArtifactRepository(database),
        new ArtifactUploadTokenRepository(database),
      ),
      auth,
      aiModels,
      cashFlow,
      delivery,
      monthlyExpenses,
      monthlyExpensePayments: new MonthlyExpensePaymentService(
        monthlyExpenses,
        cashFlow,
      ),
      messaging,
      migration: new MigrationService(migrations, config.auth),
      notes,
      status: new StatusService(
        new DatabaseStatusRepository(database),
        config.database,
        config.ai,
        config.deployment,
      ),
      todos,
      tools,
    },
  };
}
