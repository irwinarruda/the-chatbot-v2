import type { SendWebAudioDTO } from "~/modules/chat/client/entities/dtos/SendWebAudioDTO";
import type { SendWebMessageDTO } from "~/modules/chat/client/entities/dtos/SendWebMessageDTO";
import {
  ChannelMessageResponseDTO,
  type ChatMessageDTO,
  ChatMessagesResponseDTO,
  type ChatResponseProgressEventDTO,
  type WebChatDTO,
  WebChatResponseEventDTO,
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
  getChat(): Promise<WebChatDTO>;
  sendMessage(
    dto: SendWebMessageDTO,
    onProgress?: ChatProgressListener,
  ): Promise<WebChatDTO>;
  sendAudio(
    dto: SendWebAudioDTO,
    onProgress?: ChatProgressListener,
  ): Promise<WebChatDTO>;
  logout(): Promise<void>;
}

export type ChatProgressListener = (
  event: ChatResponseProgressEventDTO,
) => void;

export function parseChatMessage(data: unknown): ChatMessageDTO {
  return parseApiResponse(ChannelMessageResponseDTO, data);
}

export function parseCurrentUser(data: unknown): CurrentUserDTO {
  return parseApiResponse(CurrentUserResponseDTO, data);
}

export function parseWebChat(data: unknown): WebChatDTO {
  return parseApiResponse(ChatMessagesResponseDTO, data);
}

export function parseChatMessages(data: unknown): ChatMessageDTO[] {
  return parseWebChat(data).messages;
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

async function parseWebChatStream(
  response: Response,
  onProgress?: ChatProgressListener,
): Promise<WebChatDTO> {
  if (!response.body) {
    throw new WebChatApiError("The chat response had no body", 502);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let snapshot: WebChatDTO | undefined;
  function parseLine(line: string) {
    if (!line.trim()) return;
    const event = WebChatResponseEventDTO.parse(JSON.parse(line));
    if (event.type === "error") {
      throw new WebChatApiError(event.message, 500);
    }
    if (event.type === "snapshot") {
      snapshot = event.chat;
      return;
    }
    onProgress?.(event);
  }
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let lineEnd = buffer.indexOf("\n");
    while (lineEnd >= 0) {
      parseLine(buffer.slice(0, lineEnd));
      buffer = buffer.slice(lineEnd + 1);
      lineEnd = buffer.indexOf("\n");
    }
    if (done) break;
  }
  parseLine(buffer);
  if (!snapshot) {
    throw new WebChatApiError(
      "The chat response ended without an authoritative snapshot",
      502,
    );
  }
  return snapshot;
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

  async getChat(): Promise<WebChatDTO> {
    const response = await fetch("/api/v1/web/messages");
    if (!response.ok) throw await parseError(response);
    return parseWebChat(await response.json());
  },

  async sendMessage(
    dto: SendWebMessageDTO,
    onProgress?: ChatProgressListener,
  ): Promise<WebChatDTO> {
    const response = await fetch("/api/v1/web/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!response.ok) throw await parseError(response);
    return parseWebChatStream(response, onProgress);
  },

  async sendAudio(
    dto: SendWebAudioDTO,
    onProgress?: ChatProgressListener,
  ): Promise<WebChatDTO> {
    const response = await fetch("/api/v1/web/audio", {
      method: "POST",
      headers: {
        "Content-Type": dto.mimeType,
        "X-Client-Message-Id": dto.clientMessageId,
      },
      body: dto.blob,
    });
    if (!response.ok) throw await parseError(response);
    return parseWebChatStream(response, onProgress);
  },

  async logout(): Promise<void> {
    const response = await fetch("/api/v1/web/auth/logout", { method: "POST" });
    if (!response.ok) throw await parseError(response);
  },
};
