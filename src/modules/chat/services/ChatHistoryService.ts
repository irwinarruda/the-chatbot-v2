import type { MessageAudience } from "~/modules/chat/entities/enums/MessageAudience";
import type { MessageRole } from "~/modules/chat/entities/enums/MessageRole";
import { Message } from "~/modules/chat/entities/Message";
import type { DatabaseGateway } from "~/shared/gateway/DatabaseGateway";

export class ChatHistoryService {
  constructor(private database: DatabaseGateway) {}

  async getMessagesByIds(idUser: string, ids: string[]): Promise<Message[]> {
    if (ids.length === 0) return [];
    const rows = await this.database.sql<DbMessage[]>`
      SELECT m.* FROM messages m
      INNER JOIN chats c ON c.id = m.id_chat
      WHERE c.id_user = ${idUser}
      AND m.id IN ${this.database.sql(ids)}
      ORDER BY m.sequence ASC
    `;
    return rows.map((row) => this.restoreMessage(row));
  }

  private restoreMessage(row: DbMessage): Message {
    return Message.restore({
      id: row.id,
      idChat: row.id_chat,
      turnId: row.turn_id,
      sequence: Number(row.sequence),
      role: row.role,
      audience: row.audience,
      content: parseJsonColumn(row.content),
      generationId: row.generation_id ?? undefined,
      channelMessageId: row.channel_message_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}

function parseJsonColumn(value: unknown): unknown {
  if (typeof value === "string") return JSON.parse(value);
  return value;
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
