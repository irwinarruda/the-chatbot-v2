import {
  type WebChatEvent,
  WebChatEvent as WebChatEventContract,
} from "~/modules/chat/contracts/ChatContracts";

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
          dto.onEvent(
            WebChatEventContract.parse(JSON.parse(eventMessage.data)),
          );
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
