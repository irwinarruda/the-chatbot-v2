import { faker } from "@faker-js/faker";
import { v4 as uuidv4 } from "uuid";
import { ChatChannel } from "~/domain/chat/chat-channel";
import { BsuidUtils } from "~/domain/identity/bsuid";
import { PhoneNumberUtils } from "~/domain/identity/phone-number";
import { User } from "~/domain/identity/user";
import { ValidationException } from "~/domain/shared/domain-errors";
import type { AccountsService } from "~/server/modules/accounts/services/accounts.service";
import type { ArtifactService } from "~/server/modules/artifacts/services/artifact.service";
import { TestCashFlowSpreadsheetGateway } from "~/server/modules/cash-flow/gateways/test.cash-flow-spreadsheet";
import type { CashFlowService } from "~/server/modules/cash-flow/services/cash-flow.service";
import type { MonthlyExpenseService } from "~/server/modules/cash-flow/services/monthly-expense.service";
import { TestAiChatGateway } from "~/server/modules/chat/gateways/test.ai-chat";
import { TestSpeechToTextGateway } from "~/server/modules/chat/gateways/test.speech-to-text";
import { TestStorageGateway } from "~/server/modules/chat/gateways/test.storage";
import { TestWebMessagingGateway } from "~/server/modules/chat/gateways/test.web-messaging";
import { TestWhatsAppMessagingGateway } from "~/server/modules/chat/gateways/test.whatsapp-messaging";
import type { ChatDeliveryService } from "~/server/modules/chat/services/chat-delivery.service";
import type { MessagingService } from "~/server/modules/chat/services/messaging.service";
import type { ToolExecutor } from "~/server/modules/chat/services/tool-executor.service";
import { TestAuthGateway } from "~/server/modules/identity/gateways/test.auth";
import type { AuthService } from "~/server/modules/identity/services/auth.service";
import type { NoteService } from "~/server/modules/notes/services/note.service";
import { NodePgMigrationsGateway } from "~/server/modules/system/gateways/node-pg.migrations";
import type { MigrationService } from "~/server/modules/system/services/migration.service";
import type { StatusService } from "~/server/modules/system/services/status.service";
import type { TodoService } from "~/server/modules/todos/services/todo.service";
import { createServer } from "~/server/server";
import type {
  AiConfig,
  AuthConfig,
  Config,
  DatabaseConfig,
  GoogleConfig,
  GoogleSheetsConfig,
  JwtConfig,
  OpenAiConfig,
} from "~/server/shared/config/config";
import { loadConfig } from "~/server/shared/config/config";
import { Database } from "~/server/shared/database/postgres.database";

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
  googleConfig: GoogleConfig;
  googleSheetsConfig: GoogleSheetsConfig;
  aiConfig: AiConfig;
  authConfig: AuthConfig;
  openAiConfig: OpenAiConfig;
  jwtConfig: JwtConfig;

  authService: AuthService;
  accountsService: AccountsService;
  deliveryService: ChatDeliveryService;
  artifactService: ArtifactService;
  messagingService: MessagingService;
  statusService: StatusService;
  cashFlowService: CashFlowService;
  monthlyExpenseService: MonthlyExpenseService;
  todoService: TodoService;
  noteService: NoteService;
  migrationService: MigrationService;
  aiToolService: ToolExecutor;
  aiGateway: TestAiChatGateway;
  cashFlowSpreadsheetGateway: TestCashFlowSpreadsheetGateway;
  googleAuthGateway: TestAuthGateway;
  webMessagingGateway: TestWebMessagingGateway;
  whatsAppMessagingGateway: TestWhatsAppMessagingGateway;

  constructor() {
    this.config = loadConfig(process.env);
    this.database = new Database(this.config.database.connectionString, {
      onnotice: () => {},
    });

    this.databaseConfig = this.config.database;
    this.googleConfig = this.config.google;
    this.googleSheetsConfig = this.config.googleSheets;
    this.aiConfig = this.config.ai;
    this.authConfig = this.config.auth;
    this.openAiConfig = this.config.openAi;
    this.jwtConfig = this.config.jwt;
    this.aiGateway = new TestAiChatGateway();
    this.cashFlowSpreadsheetGateway = new TestCashFlowSpreadsheetGateway(
      this.googleSheetsConfig,
    );
    this.googleAuthGateway = new TestAuthGateway(this.googleConfig);
    this.webMessagingGateway = new TestWebMessagingGateway();
    this.whatsAppMessagingGateway = new TestWhatsAppMessagingGateway();
    const application = createServer(
      this.config,
      {
        database: this.database,
        aiChat: this.aiGateway,
        cashFlowSpreadsheet: this.cashFlowSpreadsheetGateway,
        googleAuth: this.googleAuthGateway,
        migrations: new NodePgMigrationsGateway(
          this.database,
          this.databaseConfig,
        ),
        speechToText: new TestSpeechToTextGateway(),
        storage: new TestStorageGateway(),
        webMessaging: this.webMessagingGateway,
        whatsAppMessaging: this.whatsAppMessagingGateway,
      },
      { isDevelopment: import.meta.env.DEV },
    );
    this.authService = application.services.auth;
    this.accountsService = application.services.accounts;
    this.deliveryService = application.services.delivery;
    this.artifactService = application.services.artifacts;
    this.messagingService = application.services.messaging;
    this.statusService = application.services.status;
    this.cashFlowService = application.services.cashFlow;
    this.monthlyExpenseService = application.services.monthlyExpenses;
    this.todoService = application.services.todos;
    this.noteService = application.services.notes;
    this.migrationService = application.services.migration;
    this.aiToolService = application.services.tools;
  }

  async wipeDatabase(): Promise<void> {
    await this.database.sql`DROP SCHEMA IF EXISTS public CASCADE`;
    await this.database.sql`CREATE SCHEMA public`;
  }

  async rebuildDatabase(): Promise<void> {
    await this.wipeDatabase();
    await this.migrationService.runPendingMigrations(
      this.authConfig.hashPassword,
    );
  }

  async clearDatabase(): Promise<void> {
    if ((await this.migrationService.listPendingMigrations()).length > 0) {
      await this.rebuildDatabase();
      return;
    }
    await this.truncateTables();
  }

  private async truncateTables(): Promise<void> {
    const tables = await this.database.sql<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> 'pgmigrations'
    `;
    if (tables.length === 0) return;
    await this.database.sql`
      TRUNCATE ${this.database.sql(tables.map((table) => table.tablename))}
      RESTART IDENTITY CASCADE
    `;
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
    await this.accountsService.deleteAccountByChannelAddress(channelAddress);
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
  await orquestrator.rebuildDatabase();
});

afterAll(async () => {
  await orquestrator.close();
});
