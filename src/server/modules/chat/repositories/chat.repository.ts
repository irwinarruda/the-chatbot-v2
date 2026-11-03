import { AiGeneration } from "~/domain/chat/ai-generation";
import { Chat } from "~/domain/chat/chat";
import { ChatChannel } from "~/domain/chat/chat-channel";
import {
  StoredAiGenerationMetadataDTO,
  StoredChatChannelDTO,
  StoredConversationSummaryDTO,
} from "~/domain/chat/chat-persistence";
import { ConversationSummary } from "~/domain/chat/conversation-summary";
import { Message } from "~/domain/chat/message";
import type { MessageAudience } from "~/domain/chat/message-audience";
import type { MessageRole } from "~/domain/chat/message-role";
import type { ReasoningEffort } from "~/domain/chat/reasoning-effort";
import { BsuidUtils } from "~/domain/identity/bsuid";
import type { SyncUserChatAddressesDTO } from "~/domain/identity/google-auth";
import { PhoneNumberUtils } from "~/domain/identity/phone-number";
import { ValidationException } from "~/domain/shared/domain-errors";
import type {
  DatabaseGateway,
  DatabaseGatewayParameter,
  DatabaseGatewaySql,
} from "~/server/shared/database/database";

export class ChatRepository {
  constructor(private readonly database: DatabaseGateway) {}

  async findByChannelAddress(
    channelAddress: string,
    channel?: ChatChannel,
  ): Promise<Chat | undefined> {
    if (channel === ChatChannel.WhatsApp) {
      return this.findByWhatsAppAddress(channelAddress);
    }
    if (channel === ChatChannel.Web) {
      return this.findByWebAddress(channelAddress);
    }
    if (channel !== undefined) {
      throw new ValidationException("Unsupported chat channel");
    }
    return this.findByAnyAddress(channelAddress);
  }

  async getMessagesByIds(idUser: string, ids: string[]): Promise<Message[]> {
    if (ids.length === 0) return [];
    const rows = await this.database.sql<DbMessage[]>`
      SELECT m.* FROM messages m
      INNER JOIN chats c ON c.id = m.id_chat
      WHERE c.id_user = ${idUser}
      AND m.id IN ${this.database.sql(ids)}
      ORDER BY m.sequence ASC
    `;
    return rows.map(restoreMessage);
  }

  async create(
    chat: Chat,
    sql: DatabaseGatewaySql = this.database.sql,
  ): Promise<void> {
    const idUser = chat.idUser ?? null;
    const whatsAppAddress = chat.whatsAppAddress ?? null;
    const webAddress = chat.webAddress ?? null;
    await sql`
      INSERT INTO chats (
        id,
        id_user,
        channel,
        whatsapp_address,
        web_address,
        reasoning_effort,
        created_at,
        updated_at,
        is_deleted
      )
      VALUES (
        ${chat.id},
        ${idUser},
        ${chat.channel},
        ${whatsAppAddress},
        ${webAddress},
        ${chat.reasoningEffort},
        ${chat.createdAt},
        ${chat.updatedAt},
        ${chat.isDeleted}
      )
    `;
  }

  async createMessage(
    message: Message,
    sql: DatabaseGatewaySql = this.database.sql,
  ): Promise<boolean> {
    const result = await sql<{ sequence: string }[]>`
      INSERT INTO messages (
        id,
        id_chat,
        turn_id,
        role,
        audience,
        content,
        generation_id,
        channel_message_id,
        created_at,
        updated_at
      )
      VALUES (
        ${message.id},
        ${message.idChat},
        ${message.turnId},
        ${message.role},
        ${message.audience},
        ${this.database.json(message.content)},
        ${message.generationId ?? null},
        ${message.channelMessageId ?? null},
        ${message.createdAt},
        ${message.updatedAt}
      )
      ON CONFLICT (channel_message_id) WHERE channel_message_id IS NOT NULL DO NOTHING
      RETURNING sequence
    `;
    const inserted = result[0];
    if (!inserted) return false;
    message.sequence = Number(inserted.sequence);
    return true;
  }

  async createGeneration(
    generation: AiGeneration,
    sql: DatabaseGatewaySql = this.database.sql,
  ): Promise<void> {
    let usage: DatabaseGatewayParameter | null = null;
    if (generation.usage) usage = this.database.json(generation.usage);
    let diagnostics: DatabaseGatewayParameter | null = null;
    if (generation.diagnostics) {
      diagnostics = this.database.json(generation.diagnostics);
    }
    const result = await sql<{ sequence: string }[]>`
      INSERT INTO ai_generations (
        id,
        id_chat,
        turn_id,
        provider,
        model,
        api,
        response_model,
        response_id,
        reasoning_effort,
        finish_reason,
        usage,
        diagnostics,
        created_at
      )
      VALUES (
        ${generation.id},
        ${generation.idChat},
        ${generation.turnId},
        ${generation.provider ?? null},
        ${generation.model ?? null},
        ${generation.api ?? null},
        ${generation.responseModel ?? null},
        ${generation.responseId ?? null},
        ${generation.reasoningEffort},
        ${generation.finishReason},
        ${usage},
        ${diagnostics},
        ${generation.createdAt}
      )
      RETURNING sequence
    `;
    const inserted = result[0];
    if (!inserted) {
      throw new ValidationException("AI generation could not be persisted");
    }
    generation.sequence = Number(inserted.sequence);
  }

  async saveMessage(message: Message): Promise<void> {
    await this.database.sql`
      UPDATE messages SET
        content = ${this.database.json(message.content)},
        updated_at = ${message.updatedAt}
      WHERE id = ${message.id}
    `;
  }

  async saveChannelAddress(chat: Chat): Promise<void> {
    if (chat.channel === ChatChannel.WhatsApp) {
      await this.database.sql`
        UPDATE chats SET
          channel = ${chat.channel},
          whatsapp_address = ${chat.whatsAppAddress ?? null},
          updated_at = ${chat.updatedAt}
        WHERE id = ${chat.id}
      `;
      return;
    }
    await this.database.sql`
      UPDATE chats SET
        channel = ${chat.channel},
        web_address = ${chat.webAddress ?? null},
        updated_at = ${chat.updatedAt}
      WHERE id = ${chat.id}
    `;
  }

  async save(
    chat: Chat,
    sql: DatabaseGatewaySql = this.database.sql,
  ): Promise<void> {
    await sql`
      UPDATE chats SET
        id_user = ${chat.idUser ?? null},
        channel = ${chat.channel},
        whatsapp_address = ${chat.whatsAppAddress ?? null},
        web_address = ${chat.webAddress ?? null},
        reasoning_effort = ${chat.reasoningEffort},
        updated_at = ${chat.updatedAt},
        is_deleted = ${chat.isDeleted}
      WHERE id = ${chat.id}
    `;
  }

  async saveSummary(
    chat: Chat,
    expectedSummary?: ConversationSummary,
  ): Promise<void> {
    if (!chat.summary) {
      throw new ValidationException("Conversation summary is required");
    }
    const cursorMessage = chat.messages.find(
      (message) => message.sequence === chat.summary?.compactedThroughSequence,
    );
    if (!cursorMessage) {
      throw new ValidationException(
        "The summary cursor must reference a persisted message",
      );
    }
    const result = await this.database.sql<{ id: string }[]>`
      UPDATE chats SET
        conversation_summary = ${this.database.json(chat.summary)},
        updated_at = ${chat.updatedAt}
      WHERE id = ${chat.id}
      AND conversation_summary IS NOT DISTINCT FROM ${
        expectedSummary ? this.database.json(expectedSummary) : null
      }::jsonb
      AND (
        conversation_summary IS NULL
        OR (conversation_summary->>'compactedThroughSequence')::bigint
          < ${chat.summary.compactedThroughSequence}
      )
      RETURNING id
    `;
    if (!result[0]) {
      throw new ValidationException(
        "Conversation memory changed while it was being compacted",
      );
    }
  }

  async hasChannelMessage(channelMessageId: string): Promise<boolean> {
    const result = await this.database.sql<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM messages
        WHERE channel_message_id = ${channelMessageId}
      )
    `;
    return result[0]?.exists ?? false;
  }

  async isAllowlisted(
    channel: ChatChannel,
    channelAddress: string,
  ): Promise<boolean> {
    const result = await this.database.sql<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM allowed_entries
        WHERE channel = ${channel}
        AND channel_address = ${channelAddress}
      )
    `;
    return result[0]?.exists ?? false;
  }

  async syncUserAddresses(dto: SyncUserChatAddressesDTO): Promise<void> {
    const phoneNumber = dto.phoneNumber
      ? PhoneNumberUtils.addDigitNine(dto.phoneNumber)
      : null;
    await this.database.sql`
      UPDATE chats
      SET
        id_user = ${dto.idUser},
        web_address = COALESCE(${dto.email ?? null}, web_address),
        updated_at = ${new Date()}
      WHERE is_deleted = false
      AND (
        id_user = ${dto.idUser}
        OR web_address = ${dto.email ?? null}
        OR whatsapp_address = ${dto.bsuid ?? null}
        OR whatsapp_address = ${phoneNumber}
      )
    `;
  }

  private async findByAnyAddress(
    channelAddress: string,
  ): Promise<Chat | undefined> {
    const normalizedWhatsAppAddress = BsuidUtils.containsLetter(channelAddress)
      ? channelAddress
      : PhoneNumberUtils.addDigitNine(channelAddress);
    const dbChats = await this.database.sql<DbChat[]>`
      SELECT * FROM chats
      WHERE is_deleted = false
      AND (
        whatsapp_address = ${channelAddress}
        OR web_address = ${channelAddress}
        OR whatsapp_address = ${normalizedWhatsAppAddress}
      )
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const dbChat = dbChats[0];
    if (!dbChat) return undefined;
    return this.hydrate(dbChat);
  }

  private async findByWhatsAppAddress(
    whatsAppAddress: string,
  ): Promise<Chat | undefined> {
    const dbChats = await this.database.sql<DbChat[]>`
      SELECT * FROM chats
      WHERE whatsapp_address = ${whatsAppAddress}
      AND is_deleted = false
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const dbChat = dbChats[0];
    if (!dbChat) return undefined;
    return this.hydrate(dbChat);
  }

  private async findByWebAddress(
    webAddress: string,
  ): Promise<Chat | undefined> {
    const dbChats = await this.database.sql<DbChat[]>`
      SELECT * FROM chats
      WHERE web_address = ${webAddress}
      AND is_deleted = false
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const dbChat = dbChats[0];
    if (!dbChat) return undefined;
    return this.hydrate(dbChat);
  }

  private async hydrate(dbChat: DbChat): Promise<Chat> {
    const dbMessages = await this.database.sql<DbMessage[]>`
      SELECT * FROM messages
      WHERE id_chat = ${dbChat.id}
      ORDER BY sequence ASC
    `;
    const messages = dbMessages.map(restoreMessage);
    const dbGenerations = await this.database.sql<DbAiGeneration[]>`
      SELECT * FROM ai_generations
      WHERE id_chat = ${dbChat.id}
      ORDER BY sequence ASC
    `;
    const generations = dbGenerations.map((dbGeneration) => {
      const metadata = StoredAiGenerationMetadataDTO.parse({
        usage: parseJsonColumn(dbGeneration.usage) ?? undefined,
        diagnostics: parseJsonColumn(dbGeneration.diagnostics) ?? undefined,
      });
      return AiGeneration.restore({
        id: dbGeneration.id,
        idChat: dbGeneration.id_chat,
        turnId: dbGeneration.turn_id,
        sequence: Number(dbGeneration.sequence),
        provider: dbGeneration.provider ?? undefined,
        model: dbGeneration.model ?? undefined,
        api: dbGeneration.api ?? undefined,
        responseModel: dbGeneration.response_model ?? undefined,
        responseId: dbGeneration.response_id ?? undefined,
        reasoningEffort: dbGeneration.reasoning_effort,
        finishReason: dbGeneration.finish_reason,
        ...metadata,
        createdAt: dbGeneration.created_at,
      });
    });
    let summary: ConversationSummary | undefined;
    if (
      dbChat.conversation_summary !== null &&
      dbChat.conversation_summary !== undefined
    ) {
      summary = new ConversationSummary(
        StoredConversationSummaryDTO.parse(
          parseJsonColumn(dbChat.conversation_summary),
        ),
      );
    }
    return Chat.restore({
      id: dbChat.id,
      idUser: dbChat.id_user ?? undefined,
      channel: StoredChatChannelDTO.parse(dbChat.channel),
      whatsAppAddress: dbChat.whatsapp_address ?? undefined,
      webAddress: dbChat.web_address ?? undefined,
      messages,
      generations,
      reasoningEffort: dbChat.reasoning_effort,
      summary,
      createdAt: dbChat.created_at,
      updatedAt: dbChat.updated_at,
      isDeleted: dbChat.is_deleted,
    });
  }
}

function restoreMessage(dbMessage: DbMessage): Message {
  return Message.restore({
    id: dbMessage.id,
    idChat: dbMessage.id_chat,
    turnId: dbMessage.turn_id,
    sequence: Number(dbMessage.sequence),
    role: dbMessage.role,
    audience: dbMessage.audience,
    content: parseJsonColumn(dbMessage.content),
    generationId: dbMessage.generation_id ?? undefined,
    channelMessageId: dbMessage.channel_message_id ?? undefined,
    createdAt: dbMessage.created_at,
    updatedAt: dbMessage.updated_at,
  });
}

function parseJsonColumn(value: unknown): unknown {
  if (typeof value === "string") return JSON.parse(value);
  return value;
}

interface DbChat {
  id: string;
  id_user: string | null;
  whatsapp_address: string | null;
  web_address: string | null;
  channel: string;
  reasoning_effort: ReasoningEffort;
  conversation_summary: unknown;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

interface DbMessage {
  id: string;
  id_chat: string;
  turn_id: string;
  sequence: string;
  role: MessageRole;
  audience: MessageAudience;
  content: unknown;
  generation_id: string | null;
  channel_message_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface DbAiGeneration {
  id: string;
  id_chat: string;
  turn_id: string;
  sequence: string;
  provider: string | null;
  model: string | null;
  api: string | null;
  response_model: string | null;
  response_id: string | null;
  reasoning_effort: ReasoningEffort;
  finish_reason: string;
  usage: unknown;
  diagnostics: unknown;
  created_at: Date;
}
