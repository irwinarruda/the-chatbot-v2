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

const streamIdleTimeoutMs = 45_000;

async function openWebChatStream(url: string, options: RequestInit) {
  try {
    return await apiClient.request(url, options);
  } catch (error) {
    if (error instanceof TypeError) return undefined;
    throw error;
  }
}

async function readWebChatStreamChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
) {
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      reader.read(),
      new Promise<undefined>((resolve) => {
        idleTimer = setTimeout(() => resolve(undefined), streamIdleTimeoutMs);
      }),
    ]);
  } catch (error) {
    if (error instanceof TypeError) return undefined;
    throw error;
  } finally {
    clearTimeout(idleTimer);
  }
}

async function sendThroughWebChatStream(
  url: string,
  options: RequestInit,
  onProgress?: ChatProgressListener,
) {
  const response = await openWebChatStream(url, options);
  if (!response?.body) return undefined;
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
      const chunk = await readWebChatStreamChunk(reader);
      if (!chunk) return undefined;
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      let lineEnd = buffer.indexOf("\n");
      while (lineEnd >= 0) {
        parseLine(buffer.slice(0, lineEnd));
        buffer = buffer.slice(lineEnd + 1);
        lineEnd = buffer.indexOf("\n");
      }
      if (chunk.done) return snapshot;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
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
  ): Promise<WebChatDTO | undefined> {
    return sendThroughWebChatStream(
      "/api/v1/web/messages",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dto),
      },
      onProgress,
    );
  },

  async sendAudio(
    dto: SendWebAudioDTO,
    onProgress?: ChatProgressListener,
  ): Promise<WebChatDTO | undefined> {
    return sendThroughWebChatStream(
      "/api/v1/web/audio",
      {
        method: "POST",
        headers: {
          "Content-Type": dto.mimeType,
          "X-Client-Message-Id": dto.clientMessageId,
        },
        body: dto.blob,
      },
      onProgress,
    );
  },
};
