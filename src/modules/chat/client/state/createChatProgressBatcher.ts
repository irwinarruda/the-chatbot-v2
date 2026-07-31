import type { ChatResponseProgressDTO } from "~/modules/chat/client/entities/dtos/ChatResponseProgressDTO";
import { reduceChatResponseProgressEvents } from "~/modules/chat/client/state/reduceChatResponseProgress";
import type { ChatResponseProgressEventDTO } from "~/modules/chat/entities/dtos/ChatDTO";

const progressFrameMs = 16;

interface ChatProgressBatcher {
  push: (event: ChatResponseProgressEventDTO) => void;
  cancel: () => void;
}

export function createChatProgressBatcher(
  onFlush: (progress: ChatResponseProgressDTO) => void,
): ChatProgressBatcher {
  let progress: ChatResponseProgressDTO | undefined;
  let pendingEvents: ChatResponseProgressEventDTO[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | undefined;

  function flush() {
    flushTimer = undefined;
    if (pendingEvents.length === 0) return;
    const events = pendingEvents;
    pendingEvents = [];
    progress = reduceChatResponseProgressEvents(progress, events);
    onFlush(progress);
  }

  return {
    push(event) {
      pendingEvents.push(event);
      if (flushTimer !== undefined) return;
      flushTimer = setTimeout(flush, progressFrameMs);
    },
    cancel() {
      if (flushTimer !== undefined) clearTimeout(flushTimer);
      flushTimer = undefined;
      pendingEvents = [];
      progress = undefined;
    },
  };
}
