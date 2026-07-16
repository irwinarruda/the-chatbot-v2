import type { SendWebAudioDTO } from "~/modules/chat/client/entities/dtos/SendWebAudioDTO";
import type { SendWebMessageDTO } from "~/modules/chat/client/entities/dtos/SendWebMessageDTO";
import {
  ChannelMessageResponseDTO,
  type ChatMessageDTO,
  ChatMessagesResponseDTO,
} from "~/modules/chat/entities/dtos/ChatDTO";
import {
  type CurrentUserDTO,
  CurrentUserResponseDTO,
} from "~/modules/identity/entities/dtos/IdentityDTO";
import {
  normalizeApiResponse,
  parseApiResponse,
} from "~/shared/client/utils/ApiResponseParser";
import { ApiErrorResponseDTO } from "~/shared/entities/dtos/ApiErrorDTO";

export interface WebChatClientService {
  getCurrentUser(): Promise<CurrentUserDTO>;
  getMessages(): Promise<ChatMessageDTO[]>;
  sendMessage(dto: SendWebMessageDTO): Promise<ChatMessageDTO[]>;
  sendAudio(dto: SendWebAudioDTO): Promise<ChatMessageDTO[]>;
  logout(): Promise<void>;
}

export function parseChatMessage(data: unknown): ChatMessageDTO {
  return parseApiResponse(ChannelMessageResponseDTO, data);
}

export function parseCurrentUser(data: unknown): CurrentUserDTO {
  return parseApiResponse(CurrentUserResponseDTO, data);
}

export function parseChatMessages(data: unknown): ChatMessageDTO[] {
  return parseApiResponse(ChatMessagesResponseDTO, data).messages;
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
  const body = ApiErrorResponseDTO.safeParse(
    normalizeApiResponse(await response.json()),
  );
  return new WebChatApiError(
    body.success ? body.data.message : `Request failed with ${response.status}`,
    response.status,
  );
}

export const webChatService: WebChatClientService = {
  async getCurrentUser(): Promise<CurrentUserDTO> {
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

  async getMessages(): Promise<ChatMessageDTO[]> {
    const response = await fetch("/api/v1/web/messages");
    if (!response.ok) throw await parseError(response);
    return parseChatMessages(await response.json());
  },

  async sendMessage(dto: SendWebMessageDTO): Promise<ChatMessageDTO[]> {
    const response = await fetch("/api/v1/web/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!response.ok) throw await parseError(response);
    return parseChatMessages(await response.json());
  },

  async sendAudio(dto: SendWebAudioDTO): Promise<ChatMessageDTO[]> {
    const response = await fetch("/api/v1/web/audio", {
      method: "POST",
      headers: {
        "Content-Type": dto.mimeType,
        "X-Client-Message-Id": dto.clientMessageId,
      },
      body: dto.blob,
    });
    if (!response.ok) throw await parseError(response);
    return parseChatMessages(await response.json());
  },

  async logout(): Promise<void> {
    const response = await fetch("/api/v1/web/auth/logout", { method: "POST" });
    if (!response.ok) throw await parseError(response);
  },
};
