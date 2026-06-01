import { faker } from "@faker-js/faker";
import { v4 as uuidv4 } from "uuid";
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
import { ValidationException } from "~/infra/exceptions";
import { Mediator } from "~/infra/mediator";
import { GoogleCashFlowSpreadsheetGateway } from "~/server/resources/GoogleCashFlowSpreadsheetGateway";
import { TestAiChatGateway } from "~/server/resources/TestAiChatGateway";
import { TestCashFlowSpreadsheetGateway } from "~/server/resources/TestCashFlowSpreadsheetGateway";
import { TestGoogleAuthGateway } from "~/server/resources/TestGoogleAuthGateway";
import { TestSpeechToTextGateway } from "~/server/resources/TestSpeechToTextGateway";
import { TestStorageGateway } from "~/server/resources/TestStorageGateway";
import { TestWebMessagingGateway } from "~/server/resources/TestWebMessagingGateway";
import { TestWhatsAppMessagingGateway } from "~/server/resources/TestWhatsAppMessagingGateway";
import { AuthService } from "~/server/services/AuthService";
import { CashFlowService } from "~/server/services/CashFlowService";
import {
  MessagingService,
  type RespondToMessageEvent,
} from "~/server/services/MessagingService";
import { MigrationService } from "~/server/services/MigrationService";
import { StatusService } from "~/server/services/StatusService";
import { TodoService } from "~/server/services/TodoService";
import { BsuidUtils } from "~/shared/entities/BsuidUtils";
import { MessageType } from "~/shared/entities/enums/MessageType";
import { PhoneNumberUtils } from "~/shared/entities/PhoneNumberUtils";
import { User } from "~/shared/entities/User";

export interface TranscriptDTO {
  id: string;
  transcript: string;
  mediaUrl?: string;
  mimeType?: string;
  createdAt: Date;
}

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
  todoService: TodoService;
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
      "TodoService",
      () => new TodoService(this.database),
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
    this.todoService = this.container.resolve<TodoService>("TodoService");
    this.migrationService =
      this.container.resolve<MigrationService>("MigrationService");

    this.mediator.register<string>(
      "DeleteUserByChatChannelAddress",
      async (channelAddress) => {
        const svc =
          this.container.resolve<MessagingService>("MessagingService");
        await svc.deleteChat(channelAddress);
      },
    );
    this.mediator.register<RespondToMessageEvent>(
      "RespondToMessage",
      async (data) => {
        const svc =
          this.container.resolve<MessagingService>("MessagingService");
        await svc.respondToMessage(data.chat, data.message, data.channel);
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
    email?: string;
    bsuid?: string;
  }): Promise<User> {
    const name = options?.name ?? faker.person.fullName().slice(0, 29);
    const user = new User(
      name,
      options?.phoneNumber ??
        faker.phone
          .number({ style: "national" })
          .replace(/\D/g, "")
          .padStart(13, "55"),
      options?.email ?? faker.internet.email().toLowerCase(),
    );
    if (options?.bsuid) {
      user.bsuid = options.bsuid;
    }
    await this.authService.createUser(user);
    return user;
  }

  async deleteUser(channelAddress: string): Promise<void> {
    await this.authService.deleteUserByChatChannelAddress(channelAddress);
  }

  async addAllowedNumber(phoneNumber: string): Promise<void> {
    await this.addAllowedWhatsAppId(PhoneNumberUtils.addDigitNine(phoneNumber));
  }

  async addAllowedWhatsAppId(whatsAppAddress: string): Promise<void> {
    await this.insertAllowedChannelAddress({
      whatsAppAddress: this.normalizeWhatsAppChannelAddress(whatsAppAddress),
    });
  }

  async addAllowedWebId(webAddress: string): Promise<void> {
    const normalizedWebAddress = webAddress.trim().toLowerCase();
    await this.insertAllowedChannelAddress({
      webAddress: normalizedWebAddress,
    });
  }

  private async insertAllowedChannelAddress(dto: {
    whatsAppAddress?: string;
    webAddress?: string;
  }): Promise<void> {
    if (!dto.whatsAppAddress && !dto.webAddress) {
      throw new ValidationException(
        "Allowed entry requires a WhatsApp address or Web address",
      );
    }
    await this.database.sql`
      INSERT INTO allowed_entries (id, whatsapp_address, web_address, created_at)
      VALUES (
        ${uuidv4()},
        ${dto.whatsAppAddress ?? null},
        ${dto.webAddress ?? null},
        ${new Date()}
      )
      ON CONFLICT DO NOTHING
    `;
  }

  async getTranscripts(channelAddress: string): Promise<TranscriptDTO[]> {
    const normalizedId = this.normalizeWhatsAppChannelAddress(channelAddress);
    const dbMessages = await this.database.sql<TestDbMessage[]>`
      SELECT m.* FROM messages m
      INNER JOIN chats c ON c.id = m.id_chat
      WHERE (
        c.whatsapp_address = ${channelAddress}
        OR c.whatsapp_address = ${normalizedId}
        OR c.phone_number = ${normalizedId}
        OR c.web_address = ${channelAddress}
      )
      AND c.is_deleted = false
      AND m.type = ${MessageType.Audio}
      AND m.transcript IS NOT NULL
      ORDER BY m.created_at DESC
    `;
    return dbMessages.map((m) => ({
      id: m.id,
      transcript: m.transcript ?? "",
      mediaUrl: m.media_url ?? undefined,
      mimeType: m.mime_type ?? undefined,
      createdAt: m.created_at,
    }));
  }

  private normalizeWhatsAppChannelAddress(channelAddress: string): string {
    const trimmedChannelAddress = channelAddress.trim();
    if (BsuidUtils.isValid(trimmedChannelAddress)) {
      return trimmedChannelAddress;
    }
    return PhoneNumberUtils.addDigitNine(trimmedChannelAddress);
  }

  async close(): Promise<void> {
    await this.database.close();
  }
}

interface TestDbMessage {
  id: string;
  transcript?: string;
  media_url?: string;
  mime_type?: string;
  created_at: Date;
}

export let orquestrator: Orquestrator;

beforeAll(async () => {
  orquestrator = new Orquestrator();
});

afterAll(async () => {
  await orquestrator.close();
});
