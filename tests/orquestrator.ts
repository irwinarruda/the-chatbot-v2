import { faker } from "@faker-js/faker";
import { v4 as uuidv4 } from "uuid";
import { createApplication } from "~/infra/bootstrap";
import { Database } from "~/infra/database";
import { TestCashFlowSpreadsheetGateway } from "~/modules/cash-flow/gateway/CashFlowSpreadsheetGateway/TestCashFlowSpreadsheetGateway";
import type { CashFlowService } from "~/modules/cash-flow/services/CashFlowService";
import type { MonthlyExpenseService } from "~/modules/cash-flow/services/MonthlyExpenseService";
import { ChatChannel } from "~/modules/chat/entities/enums/ChatChannel";
import { TestAiChatGateway } from "~/modules/chat/gateway/AiChatGateway/TestAiChatGateway";
import { TestSpeechToTextGateway } from "~/modules/chat/gateway/SpeechToTextGateway/TestSpeechToTextGateway";
import { TestStorageGateway } from "~/modules/chat/gateway/StorageGateway/TestStorageGateway";
import { TestWebMessagingGateway } from "~/modules/chat/gateway/WebMessagingGateway/TestWebMessagingGateway";
import { TestWhatsAppMessagingGateway } from "~/modules/chat/gateway/WhatsAppMessagingGateway/TestWhatsAppMessagingGateway";
import type { AiToolService } from "~/modules/chat/services/AiToolService";
import type { MessagingService } from "~/modules/chat/services/MessagingService";
import { BsuidUtils } from "~/modules/identity/entities/BsuidUtils";
import { PhoneNumberUtils } from "~/modules/identity/entities/PhoneNumberUtils";
import { User } from "~/modules/identity/entities/User";
import { TestAuthGateway } from "~/modules/identity/gateway/AuthGateway/TestAuthGateway";
import type {
  AuthService,
  IdentityChatCoordinator,
} from "~/modules/identity/services/AuthService";
import type { MigrationService } from "~/modules/system/services/MigrationService";
import type { StatusService } from "~/modules/system/services/StatusService";
import type { TodoService } from "~/modules/todos/services/TodoService";
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
} from "~/shared/config/Config";
import { loadConfig } from "~/shared/config/Config";
import { ValidationException } from "~/shared/errors/DomainErrors";

export interface TranscriptDTO {
  id: string;
  transcript: string;
  mediaUrl?: string;
  mimeType?: string;
  createdAt: Date;
}

export class Orquestrator {
  config: Config;
  database: Database;

  databaseConfig: DatabaseConfig;
  encryptionConfig: EncryptionConfig;
  googleConfig: GoogleConfig;
  googleSheetsConfig: GoogleSheetsConfig;
  aiConfig: AiConfig;
  authConfig: AuthConfig;
  openAiConfig: OpenAiConfig;
  jwtConfig: JwtConfig;

  authService: AuthService;
  messagingService: MessagingService;
  statusService: StatusService;
  cashFlowService: CashFlowService;
  monthlyExpenseService: MonthlyExpenseService;
  todoService: TodoService;
  migrationService: MigrationService;
  aiToolService: AiToolService;
  aiGateway: TestAiChatGateway;
  googleAuthGateway: TestAuthGateway;
  webMessagingGateway: TestWebMessagingGateway;
  whatsAppMessagingGateway: TestWhatsAppMessagingGateway;
  identityChatCoordinator: IdentityChatCoordinator;

  constructor() {
    this.config = loadConfig();
    this.database = new Database(this.config.database.connectionString, {
      onnotice: () => {},
    });

    this.databaseConfig = this.config.database;
    this.encryptionConfig = this.config.encryption;
    this.googleConfig = this.config.google;
    this.googleSheetsConfig = this.config.googleSheets;
    this.aiConfig = this.config.ai;
    this.authConfig = this.config.auth;
    this.openAiConfig = this.config.openAi;
    this.jwtConfig = this.config.jwt;
    this.aiGateway = new TestAiChatGateway();
    this.googleAuthGateway = new TestAuthGateway(this.googleConfig);
    this.webMessagingGateway = new TestWebMessagingGateway();
    this.whatsAppMessagingGateway = new TestWhatsAppMessagingGateway();
    const application = createApplication(this.config, {
      database: this.database,
      gateways: {
        aiChat: this.aiGateway,
        cashFlowSpreadsheet: new TestCashFlowSpreadsheetGateway(
          this.googleSheetsConfig,
        ),
        googleAuth: this.googleAuthGateway,
        speechToText: new TestSpeechToTextGateway(),
        storage: new TestStorageGateway(),
        webMessaging: this.webMessagingGateway,
        whatsAppMessaging: this.whatsAppMessagingGateway,
      },
      coordination: {
        sendSignedInMessage: async () => {},
      },
    });
    this.authService = application.services.auth;
    this.messagingService = application.services.messaging;
    this.statusService = application.services.status;
    this.cashFlowService = application.services.cashFlow;
    this.monthlyExpenseService = application.services.monthlyExpenses;
    this.todoService = application.services.todos;
    this.migrationService = application.services.migration;
    this.aiToolService = application.services.tools;
    this.identityChatCoordinator = application.coordination.identityChat;
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
      channel: ChatChannel.WhatsApp,
      channelAddress: this.normalizeWhatsAppChannelAddress(whatsAppAddress),
    });
  }

  async addAllowedWebId(webAddress: string): Promise<void> {
    await this.insertAllowedChannelAddress({
      channel: ChatChannel.Web,
      channelAddress: webAddress.trim().toLowerCase(),
    });
  }

  private async insertAllowedChannelAddress(dto: {
    channel: ChatChannel;
    channelAddress: string;
  }): Promise<void> {
    if (!dto.channelAddress) {
      throw new ValidationException("Allowed entry requires a channel address");
    }
    await this.database.sql`
      INSERT INTO allowed_entries (id, channel, channel_address, created_at)
      VALUES (
        ${uuidv4()},
        ${dto.channel},
        ${dto.channelAddress},
        ${new Date()}
      )
      ON CONFLICT DO NOTHING
    `;
  }

  async getTranscripts(channelAddress: string): Promise<TranscriptDTO[]> {
    const normalizedId = this.normalizeWhatsAppChannelAddress(channelAddress);
    const dbMessages = await this.database.sql<TestDbMessage[]>`
      SELECT
        m.id,
        m.content->>'transcript' AS transcript,
        m.content->>'mediaUrl' AS media_url,
        m.content->>'mimeType' AS mime_type,
        m.created_at
      FROM messages m
      INNER JOIN chats c ON c.id = m.id_chat
      WHERE (
        c.whatsapp_address = ${channelAddress}
        OR c.whatsapp_address = ${normalizedId}
        OR c.phone_number = ${normalizedId}
        OR c.web_address = ${channelAddress}
      )
      AND c.is_deleted = false
      AND m.content->>'type' = 'audio'
      AND m.content->>'transcript' IS NOT NULL
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
    if (BsuidUtils.containsLetter(trimmedChannelAddress)) {
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
