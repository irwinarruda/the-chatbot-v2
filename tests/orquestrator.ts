import { faker } from "@faker-js/faker";
import { User } from "~/entities/User";
import type {
  AiConfig,
  AuthConfig,
  Config,
  DatabaseConfig,
  EncryptionConfig,
  GoogleConfig,
  GoogleSheetsConfig,
  JwtConfig,
  OpenAiConfig,
  SummarizationConfig,
} from "~/infra/config";
import { loadConfig } from "~/infra/config";
import { Container } from "~/infra/container";
import { Database } from "~/infra/database";
import { Mediator } from "~/infra/Mediator";
import { GoogleCashFlowSpreadsheetGateway } from "~/resources/GoogleCashFlowSpreadsheetGateway";
import { TestAiChatGateway } from "~/resources/TestAiChatGateway";
import { TestCashFlowSpreadsheetGateway } from "~/resources/TestCashFlowSpreadsheetGateway";
import { TestGoogleAuthGateway } from "~/resources/TestGoogleAuthGateway";
import { TestSpeechToTextGateway } from "~/resources/TestSpeechToTextGateway";
import { TestStorageGateway } from "~/resources/TestStorageGateway";
import { TestWebMessagingGateway } from "~/resources/TestWebMessagingGateway";
import { TestWhatsAppMessagingGateway } from "~/resources/TestWhatsAppMessagingGateway";
import { AuthService } from "~/services/AuthService";
import { CashFlowService } from "~/services/CashFlowService";
import {
  MessagingService,
  type RespondToMessageEvent,
} from "~/services/MessagingService";
import { MigrationService } from "~/services/MigrationService";
import { StatusService } from "~/services/StatusService";

export class Orquestrator {
  config: Config;
  container: Container;
  database: Database;
  mediator: Mediator;

  databaseConfig: DatabaseConfig;
  encryptionConfig: EncryptionConfig;
  googleConfig: GoogleConfig;
  googleSheetsConfig: GoogleSheetsConfig;
  aiConfig: AiConfig;
  authConfig: AuthConfig;
  summarizationConfig: SummarizationConfig;
  openAiConfig: OpenAiConfig;
  jwtConfig: JwtConfig;

  authService: AuthService;
  messagingService: MessagingService;
  statusService: StatusService;
  cashFlowService: CashFlowService;
  migrationService: MigrationService;

  constructor() {
    this.config = loadConfig();
    this.container = new Container();
    this.database = new Database(this.config.database.connectionString, {
      onnotice: () => {},
    });
    this.mediator = new Mediator();

    this.databaseConfig = this.config.database;
    this.encryptionConfig = this.config.encryption;
    this.googleConfig = this.config.google;
    this.googleSheetsConfig = this.config.googleSheets;
    this.aiConfig = this.config.ai;
    this.authConfig = this.config.auth;
    this.summarizationConfig = this.config.summarization;
    this.openAiConfig = this.config.openAi;
    this.jwtConfig = this.config.jwt;

    this.container.register("Database", () => this.database, "singleton");
    this.container.register("Mediator", () => this.mediator, "singleton");

    this.container.register(
      "DatabaseConfig",
      () => this.databaseConfig,
      "singleton",
    );
    this.container.register(
      "EncryptionConfig",
      () => this.encryptionConfig,
      "singleton",
    );
    this.container.register(
      "GoogleConfig",
      () => this.googleConfig,
      "singleton",
    );
    this.container.register(
      "WhatsAppConfig",
      () => this.config.whatsApp,
      "singleton",
    );
    this.container.register("R2Config", () => this.config.r2, "singleton");
    this.container.register("AiConfig", () => this.aiConfig, "singleton");
    this.container.register(
      "OpenAiConfig",
      () => this.openAiConfig,
      "singleton",
    );
    this.container.register("AuthConfig", () => this.authConfig, "singleton");
    this.container.register(
      "SummarizationConfig",
      () => this.summarizationConfig,
      "singleton",
    );
    this.container.register(
      "GoogleSheetsConfig",
      () => this.googleSheetsConfig,
      "singleton",
    );

    this.container.register(
      "IGoogleAuthGateway",
      () => new TestGoogleAuthGateway(this.googleConfig),
      "singleton",
    );
    this.container.register(
      "IWhatsAppMessagingGateway",
      () => new TestWhatsAppMessagingGateway(),
      "singleton",
    );
    this.container.register(
      "IWebMessagingGateway",
      () => new TestWebMessagingGateway(),
      "singleton",
    );
    this.container.register(
      "IAiChatGateway",
      () => new TestAiChatGateway(),
      "singleton",
    );
    this.container.register(
      "IStorageGateway",
      () => new TestStorageGateway(),
      "singleton",
    );
    this.container.register(
      "ISpeechToTextGateway",
      () => new TestSpeechToTextGateway(),
      "singleton",
    );
    this.container.register(
      "ICashFlowSpreadsheetGateway",
      () =>
        this.googleSheetsConfig.testSheetId !== "TestSheetId"
          ? new GoogleCashFlowSpreadsheetGateway(
              this.googleConfig,
              this.googleSheetsConfig,
            )
          : new TestCashFlowSpreadsheetGateway(this.googleSheetsConfig),
      "singleton",
    );

    this.container.register(
      "StatusService",
      () =>
        new StatusService(this.database, this.databaseConfig, this.aiConfig),
      "singleton",
    );
    this.container.register(
      "MigrationService",
      () =>
        new MigrationService(
          this.database,
          this.databaseConfig,
          this.authConfig,
        ),
      "transient",
    );
    this.container.register(
      "AuthService",
      () =>
        new AuthService(
          this.database,
          this.encryptionConfig,
          this.jwtConfig,
          this.container.resolve("IGoogleAuthGateway"),
          this.mediator,
        ),
      "singleton",
    );
    this.container.register(
      "CashFlowService",
      () =>
        new CashFlowService(
          this.database,
          this.container.resolve("AuthService"),
          this.container.resolve("ICashFlowSpreadsheetGateway"),
        ),
      "singleton",
    );
    this.container.register(
      "MessagingService",
      () =>
        new MessagingService(
          this.database,
          this.container.resolve("AuthService"),
          this.mediator,
          this.container.resolve("IWhatsAppMessagingGateway"),
          this.container.resolve("IWebMessagingGateway"),
          this.container.resolve("IAiChatGateway"),
          this.container.resolve("IStorageGateway"),
          this.container.resolve("ISpeechToTextGateway"),
          this.summarizationConfig,
        ),
      "singleton",
    );

    this.authService = this.container.resolve<AuthService>("AuthService");
    this.messagingService =
      this.container.resolve<MessagingService>("MessagingService");
    this.statusService = this.container.resolve<StatusService>("StatusService");
    this.cashFlowService =
      this.container.resolve<CashFlowService>("CashFlowService");
    this.migrationService =
      this.container.resolve<MigrationService>("MigrationService");

    this.mediator.register<string>(
      "DeleteUserByPhoneNumber",
      async (phoneNumber) => {
        const svc =
          this.container.resolve<MessagingService>("MessagingService");
        await svc.deleteChat(phoneNumber);
      },
    );
    this.mediator.register<RespondToMessageEvent>(
      "RespondToMessage",
      async (data) => {
        const svc =
          this.container.resolve<MessagingService>("MessagingService");
        await svc.respondToMessage(data.chat, data.message, data.chatType);
      },
    );
  }

  async wipeDatabase(): Promise<void> {
    await this.database.sql`DROP SCHEMA public CASCADE`;
    await this.database.sql`CREATE SCHEMA public`;
  }

  async clearDatabase(): Promise<void> {
    await this.wipeDatabase();
    await this.migrationService.runPendingMigrations(
      this.authConfig.hashPassword,
    );
  }

  async createUser(options?: {
    name?: string;
    phoneNumber?: string;
  }): Promise<User> {
    const user = new User(
      options?.name ?? faker.person.fullName(),
      options?.phoneNumber ??
        faker.phone
          .number({ style: "national" })
          .replace(/\D/g, "")
          .padStart(13, "55"),
    );
    await this.authService.createUser(user);
    return user;
  }

  async deleteUser(phoneNumber: string): Promise<void> {
    await this.authService.deleteUserByPhoneNumber(phoneNumber);
  }

  async close(): Promise<void> {
    await this.database.close();
  }
}

export let orquestrator: Orquestrator;

beforeAll(async () => {
  orquestrator = new Orquestrator();
});

afterAll(async () => {
  await orquestrator.close();
});
