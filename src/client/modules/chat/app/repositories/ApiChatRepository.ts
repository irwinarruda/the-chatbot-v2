import type { SendWebAudioDTO } from "~/client/modules/chat/app/dtos/SendWebAudioDTO";
import type { SendWebMessageDTO } from "~/client/modules/chat/app/dtos/SendWebMessageDTO";
import type {
  ChatProgressListener,
  ChatRepository,
} from "~/client/modules/chat/app/repositories/ChatRepository";
import { apiClient } from "~/client/shared/app/gateways/ApiClient";
import { ApiError } from "~/client/shared/error/ApiError";
import {
  ChannelMessageResponseDTO,
  type ChatMessageDTO,
  ChatMessagesResponseDTO,
  type WebChatDTO,
  WebChatResponseEventDTO,
} from "~/contracts/http/chat/chat";

export function parseChatMessage(data: unknown): ChatMessageDTO {
  return ChannelMessageResponseDTO.parse(data);
}

export function parseWebChat(data: unknown): WebChatDTO {
  return ChatMessagesResponseDTO.parse(data);
}

export function parseChatMessages(data: unknown): ChatMessageDTO[] {
  return parseWebChat(data).messages;
}

async function parseWebChatStream(
  response: Response,
  onProgress?: ChatProgressListener,
): Promise<WebChatDTO> {
  if (!response.body) {
    throw new ApiError("The chat response had no body", 502);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let snapshot: WebChatDTO | undefined;
  function parseLine(line: string) {
    if (!line.trim()) return;
    const event = WebChatResponseEventDTO.parse(JSON.parse(line));
    if (event.type === "error") {
      throw new ApiError(event.message, 500);
    }
    if (event.type === "snapshot") {
      snapshot = event.chat;
      return;
    }
    onProgress?.(event);
  }
  try {
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
      throw new ApiError(
        "The chat response ended without an authoritative snapshot",
        502,
      );
    }
    return snapshot;
  } finally {
    try {
      await reader.cancel();
    } finally {
      reader.releaseLock();
    }
  }
}

export const apiChatRepository: ChatRepository = {
  async getChat(): Promise<WebChatDTO> {
    const response = await apiClient.request("/api/v1/web/messages");
    return parseWebChat(await response.json());
  },

  async sendMessage(
    dto: SendWebMessageDTO,
    onProgress?: ChatProgressListener,
  ): Promise<WebChatDTO> {
    const response = await apiClient.request("/api/v1/web/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    return parseWebChatStream(response, onProgress);
  },

  async sendAudio(
    dto: SendWebAudioDTO,
    onProgress?: ChatProgressListener,
  ): Promise<WebChatDTO> {
    const response = await apiClient.request("/api/v1/web/audio", {
      method: "POST",
      headers: {
        "Content-Type": dto.mimeType,
        "X-Client-Message-Id": dto.clientMessageId,
      },
      body: dto.blob,
    });
    return parseWebChatStream(response, onProgress);
  },
};
