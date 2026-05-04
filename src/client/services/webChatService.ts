import type { ChatMessage } from "~/client/entities/ChatMessage";
import type { CurrentUser } from "~/client/entities/CurrentUser";
import type { SendWebAudioDto } from "~/client/entities/dtos/SendWebAudioDto";
import type { SendWebMessageDto } from "~/client/entities/dtos/SendWebMessageDto";

export type WireChatMessage = {
  id: string;
  type: ChatMessage["type"];
  user_type: ChatMessage["userType"];
  text?: string;
  button_reply?: string;
  button_reply_options?: string[];
  media_url?: string;
  mime_type?: string;
  transcript?: string;
  created_at: string;
};

export type WireCurrentUser = {
  id: string;
  name: string;
  email?: string;
  phone_number: string;
};

export function parseCurrentUser(data: WireCurrentUser): CurrentUser {
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    phoneNumber: data.phone_number,
  };
}

export function parseChatMessage(message: WireChatMessage): ChatMessage {
  return {
    id: message.id,
    type: message.type,
    userType: message.user_type,
    text: message.text,
    buttonReply: message.button_reply,
    buttonReplyOptions: message.button_reply_options,
    mediaUrl: message.media_url,
    mimeType: message.mime_type,
    transcript: message.transcript,
    createdAt: message.created_at,
  };
}

export class WebChatAuthError extends Error {
  constructor(public readonly reason: "unauthorized" | "not_registered") {
    super(reason);
    this.name = "WebChatAuthError";
  }
}

export const webChatService = {
  async getCurrentUser(): Promise<CurrentUser | undefined> {
    try {
      const res = await fetch("/api/v1/web/auth/me");
      if (res.status === 401) {
        throw new WebChatAuthError("unauthorized");
      }
      if (!res.ok) {
        console.error(
          `[webChatService] GET /api/v1/web/auth/me failed with status ${res.status}`,
        );
        return undefined;
      }
      const data = await res.json();
      if (data.error) {
        throw new WebChatAuthError("not_registered");
      }
      return parseCurrentUser(data as WireCurrentUser);
    } catch (e) {
      if (e instanceof WebChatAuthError) throw e;
      console.error("[webChatService] getCurrentUser threw:", e);
      return undefined;
    }
  },

  async getMessages(): Promise<ChatMessage[]> {
    try {
      const res = await fetch("/api/v1/web/messages");
      if (!res.ok) {
        console.error(
          `[webChatService] GET /api/v1/web/messages failed with status ${res.status}`,
        );
        return [];
      }
      const data = await res.json();
      const messages = (data.messages ?? []) as WireChatMessage[];
      return messages.map(parseChatMessage);
    } catch (e) {
      console.error("[webChatService] getMessages threw:", e);
      return [];
    }
  },

  async sendMessage(dto: SendWebMessageDto): Promise<void> {
    const res = await fetch("/api/v1/web/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      console.error(
        `[webChatService] POST /api/v1/web/messages failed with status ${res.status}`,
      );
      throw new Error("sendMessage failed");
    }
  },

  async sendAudio(dto: SendWebAudioDto): Promise<void> {
    const res = await fetch("/api/v1/web/audio", {
      method: "POST",
      headers: { "Content-Type": dto.mimeType },
      body: dto.blob,
    });
    if (!res.ok) {
      console.error(
        `[webChatService] POST /api/v1/web/audio failed with status ${res.status}`,
      );
      throw new Error("sendAudio failed");
    }
  },

  async logout(): Promise<void> {
    try {
      const res = await fetch("/api/v1/web/auth/logout", { method: "POST" });
      if (!res.ok) {
        console.error(
          `[webChatService] POST /api/v1/web/auth/logout failed with status ${res.status}`,
        );
      }
    } catch (e) {
      console.error("[webChatService] logout threw:", e);
    }
  },
};
