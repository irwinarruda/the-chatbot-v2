import { Mediator } from "~/infra/Mediator";
import { AiChatGateway } from "~/resources/AiChatGateway";
import { GoogleAuthGateway } from "~/resources/GoogleAuthGateway";
import { GoogleCashFlowSpreadsheetGateway } from "~/resources/GoogleCashFlowSpreadsheetGateway";
import { OpenAiSpeechToTextGateway } from "~/resources/OpenAiSpeechToTextGateway";
import { R2StorageGateway } from "~/resources/R2StorageGateway";
import { TuiWhatsAppMessagingGateway } from "~/resources/TuiWhatsAppMessagingGateway";
import { WebMessagingGateway } from "~/resources/WebMessagingGateway";
import { WhatsAppMessagingGateway } from "~/resources/WhatsAppMessagingGateway";
import { AuthService } from "~/services/AuthService";
import { CashFlowService } from "~/services/CashFlowService";
import {
  MessagingService,
  type RespondToMessageEvent,
} from "~/services/MessagingService";
import { MigrationService } from "~/services/MigrationService";
import { StatusService } from "~/services/StatusService";
import type { Config } from "./config";
import { container } from "./container";
import { Database } from "./database";
import { shouldUseTuiGateway } from "./tui";

export function registerDependencies(config: Config) {
  const database = new Database(config.database.connectionString);
  const mediator = new Mediator();

  container.register("Database", () => database, "singleton");
  container.register("Mediator", () => mediator, "singleton");

  container.register("DatabaseConfig", () => config.database, "singleton");
  container.register("EncryptionConfig", () => config.encryption, "singleton");
  container.register("GoogleConfig", () => config.google, "singleton");
  container.register("WhatsAppConfig", () => config.whatsApp, "singleton");
  container.register("R2Config", () => config.r2, "singleton");
  container.register("AiConfig", () => config.ai, "singleton");
  container.register("OpenAiConfig", () => config.openAi, "singleton");
  container.register("AuthConfig", () => config.auth, "singleton");
  container.register(
    "SummarizationConfig",
    () => config.summarization,
    "singleton",
  );
  container.register(
    "GoogleSheetsConfig",
    () => config.googleSheets,
    "singleton",
  );

  container.register(
    "IWhatsAppMessagingGateway",
    () =>
      shouldUseTuiGateway(config)
        ? new TuiWhatsAppMessagingGateway()
        : new WhatsAppMessagingGateway(config.whatsApp),
    "singleton",
  );
  container.register(
    "IWebMessagingGateway",
    () => new WebMessagingGateway(),
    "singleton",
  );
  container.register(
    "IStorageGateway",
    () => new R2StorageGateway(config.r2),
    "singleton",
  );
  container.register(
    "ISpeechToTextGateway",
    () => new OpenAiSpeechToTextGateway(config.openAi),
    "singleton",
  );
  container.register(
    "IGoogleAuthGateway",
    () => new GoogleAuthGateway(config.google),
    "singleton",
  );
  container.register(
    "ICashFlowSpreadsheetGateway",
    () =>
      new GoogleCashFlowSpreadsheetGateway(config.google, config.googleSheets),
    "singleton",
  );

  container.register(
    "StatusService",
    () => new StatusService(database, config.database, config.ai),
    "singleton",
  );
  container.register(
    "MigrationService",
    () => new MigrationService(database, config.database, config.auth),
    "transient",
  );
  container.register(
    "AuthService",
    () =>
      new AuthService(
        database,
        config.encryption,
        config.jwt,
        container.resolve("IGoogleAuthGateway"),
        mediator,
      ),
    "singleton",
  );
  container.register(
    "CashFlowService",
    () =>
      new CashFlowService(
        database,
        container.resolve("AuthService"),
        container.resolve("ICashFlowSpreadsheetGateway"),
      ),
    "singleton",
  );
  container.register(
    "IAiChatGateway",
    () =>
      new AiChatGateway(
        config.ai,
        container.resolve("CashFlowService"),
        container.resolve("AuthService"),
      ),
    "singleton",
  );
  container.register(
    "MessagingService",
    () =>
      new MessagingService(
        database,
        container.resolve("AuthService"),
        mediator,
        container.resolve("IWhatsAppMessagingGateway"),
        container.resolve("IWebMessagingGateway"),
        container.resolve("IAiChatGateway"),
        container.resolve("IStorageGateway"),
        container.resolve("ISpeechToTextGateway"),
        config.summarization,
      ),
    "singleton",
  );

  mediator.register<string>(
    "SaveUserByGoogleCredential",
    async (phoneNumber) => {
      const messagingService =
        container.resolve<MessagingService>("MessagingService");
      await messagingService.sendSignedInMessage(phoneNumber);
    },
  );
  mediator.register<string>("DeleteUserByPhoneNumber", async (phoneNumber) => {
    const messagingService =
      container.resolve<MessagingService>("MessagingService");
    await messagingService.deleteChat(phoneNumber);
  });
  mediator.register<RespondToMessageEvent>("RespondToMessage", async (data) => {
    const messagingService =
      container.resolve<MessagingService>("MessagingService");
    await messagingService.respondToMessage(
      data.chat,
      data.message,
      data.chatType,
    );
  });
}
