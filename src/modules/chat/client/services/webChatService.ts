import type { SendWebAudioDTO } from "~/modules/chat/client/entities/dtos/SendWebAudioDTO";
import type { SendWebMessageDTO } from "~/modules/chat/client/entities/dtos/SendWebMessageDTO";
import {
  ChannelMessageResponse,
  ChatMessagesResponse,
} from "~/modules/chat/entities/dtos/ChatDTO";
import { CurrentUserResponse as IdentityCurrentUserResponse } from "~/modules/identity/entities/dtos/IdentityDTO";
import {
  normalizeApiResponse,
  parseApiResponse,
} from "~/shared/client/utils/ApiResponseParser";
import { ApiErrorResponse } from "~/shared/entities/dtos/ApiErrorDTO";

export type ChatMessage = ChannelMessageResponse;
export type CurrentUser = IdentityCurrentUserResponse;

export function parseChatMessage(data: unknown): ChatMessage {
  return parseApiResponse(ChannelMessageResponse, data);
}

export function parseCurrentUser(data: unknown): CurrentUser {
  return parseApiResponse(IdentityCurrentUserResponse, data);
}

export class WebChatAuthError extends Error {
  constructor(public readonly reason: "unauthorized" | "not_registered") {
    super(reason);
    this.name = "WebChatAuthError";
  }
}

export class WebChatApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "WebChatApiError";
  }
}

async function parseError(response: Response): Promise<WebChatApiError> {
  const body = ApiErrorResponse.safeParse(
    normalizeApiResponse(await response.json()),
  );
  return new WebChatApiError(
    body.success ? body.data.message : `Request failed with ${response.status}`,
    response.status,
  );
}

export const webChatService = {
  async getCurrentUser(): Promise<CurrentUser> {
    const response = await fetch("/api/v1/web/auth/me");
    if (response.status === 401) {
      throw new WebChatAuthError("unauthorized");
    }
    if (response.status === 404) {
      throw new WebChatAuthError("not_registered");
    }
    if (!response.ok) throw await parseError(response);
    return parseCurrentUser(await response.json());
  },

  async getMessages(): Promise<ChatMessage[]> {
    const response = await fetch("/api/v1/web/messages");
    if (!response.ok) throw await parseError(response);
    return parseApiResponse(ChatMessagesResponse, await response.json())
      .messages;
  },

  async sendMessage(dto: SendWebMessageDTO): Promise<void> {
    const response = await fetch("/api/v1/web/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!response.ok) throw await parseError(response);
  },

  async sendAudio(dto: SendWebAudioDTO): Promise<void> {
    const response = await fetch("/api/v1/web/audio", {
      method: "POST",
      headers: {
        "Content-Type": dto.mimeType,
        "X-Client-Message-Id": dto.clientMessageId,
      },
      body: dto.blob,
    });
    if (!response.ok) throw await parseError(response);
  },

  async logout(): Promise<void> {
    const response = await fetch("/api/v1/web/auth/logout", { method: "POST" });
    if (!response.ok) throw await parseError(response);
  },
};
