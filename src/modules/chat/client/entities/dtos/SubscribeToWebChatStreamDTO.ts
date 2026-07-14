import type { WebChatEvent } from "~/modules/chat/entities/dtos/ChatDTO";

export type SubscribeToWebChatStreamDTO = {
  onOpen: () => void;
  onClose: () => void;
  onEvent: (event: WebChatEvent) => void;
  onMalformedEvent?: () => void;
  retryMs?: number;
};
