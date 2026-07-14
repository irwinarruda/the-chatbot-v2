import type { SubscribeToWebChatStreamDTO } from "~/modules/chat/client/entities/dtos/SubscribeToWebChatStreamDTO";
import {
  type WebChatEvent,
  WebChatEvent as WebChatEventContract,
} from "~/modules/chat/entities/dtos/ChatDTO";
import { parseApiResponse } from "~/shared/client/utils/ApiResponseParser";

export function parseWebChatEvent(data: unknown): WebChatEvent {
  return parseApiResponse(WebChatEventContract, data);
}

export const webChatStreamService = {
  subscribe(dto: SubscribeToWebChatStreamDTO): () => void {
    let eventSource: EventSource | undefined;
    let retryTimeout: ReturnType<typeof setTimeout> | undefined;
    let active = true;

    function connect() {
      eventSource = new EventSource("/api/v1/web/stream");

      eventSource.onopen = () => {
        dto.onOpen();
      };

      eventSource.onmessage = (eventMessage) => {
        try {
          dto.onEvent(parseWebChatEvent(JSON.parse(eventMessage.data)));
        } catch {
          dto.onMalformedEvent?.();
        }
      };

      eventSource.onerror = () => {
        dto.onClose();
        eventSource?.close();
        eventSource = undefined;
        if (active) {
          retryTimeout = setTimeout(connect, dto.retryMs ?? 3000);
        }
      };
    }

    connect();

    return () => {
      active = false;
      clearTimeout(retryTimeout);
      eventSource?.close();
      eventSource = undefined;
    };
  },
};
