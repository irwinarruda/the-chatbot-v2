import type { WebChatEvent } from "~/shared/entities/events/WebChatEvent";

type SubscribeToWebChatStreamDto = {
  onOpen: () => void;
  onClose: () => void;
  onEvent: (event: WebChatEvent) => void;
  onMalformedEvent?: () => void;
  retryMs?: number;
};

export const webChatStreamService = {
  subscribe(dto: SubscribeToWebChatStreamDto): () => void {
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
          const event: WebChatEvent = JSON.parse(eventMessage.data);
          dto.onEvent(event);
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
