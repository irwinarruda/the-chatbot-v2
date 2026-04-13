import { NotFoundException } from "@infra/exceptions";
import type {
  SendInteractiveButtonMessageDTO,
  SendTextMessageDTO,
} from "~/resources/IMessagingGateway";
import type {
  IWebMessagingGateway,
  WebChatEvent,
} from "~/resources/IWebMessagingGateway";

export class WebMessagingGateway implements IWebMessagingGateway {
  private mediaById = new Map<string, Buffer>();
  private waiters = new Map<string, Array<(event: WebChatEvent) => void>>();
  private queues = new Map<string, WebChatEvent[]>();

  async sendTextMessage(dto: SendTextMessageDTO): Promise<void> {
    this.enqueue(dto.to, { type: "text", data: dto });
  }

  async sendInteractiveReplyButtonMessage(
    dto: SendInteractiveButtonMessageDTO,
  ): Promise<void> {
    this.enqueue(dto.to, { type: "interactive_button", data: dto });
  }

  async saveMediaAsync(buffer: Buffer): Promise<string> {
    const mediaId = crypto.randomUUID();
    this.mediaById.set(mediaId, buffer);
    return mediaId;
  }

  async downloadMediaAsync(mediaId: string): Promise<Buffer> {
    const mediaBytes = this.mediaById.get(mediaId);
    if (!mediaBytes) {
      throw new NotFoundException(
        "Audio file was not found in the web media store",
      );
    }
    return mediaBytes;
  }

  enqueue(phoneNumber: string, event: WebChatEvent): void {
    const phoneWaiters = this.waiters.get(phoneNumber);
    if (phoneWaiters && phoneWaiters.length > 0) {
      const waiter = phoneWaiters.shift();
      if (waiter) {
        waiter(event);
        return;
      }
    }
    let queue = this.queues.get(phoneNumber);
    if (!queue) {
      queue = [];
      this.queues.set(phoneNumber, queue);
    }
    queue.push(event);
  }

  async *subscribe(
    phoneNumber: string,
    signal: AbortSignal,
  ): AsyncGenerator<WebChatEvent> {
    while (!signal.aborted) {
      const queue = this.queues.get(phoneNumber);
      if (queue && queue.length > 0) {
        const event = queue.shift();
        if (event) yield event;
        continue;
      }
      try {
        const event = await new Promise<WebChatEvent>((resolve, reject) => {
          let waiter: ((e: WebChatEvent) => void) | null = null;
          const onAbort = () => {
            const phoneWaiters = this.waiters.get(phoneNumber);
            if (phoneWaiters && waiter) {
              const idx = phoneWaiters.indexOf(waiter);
              if (idx >= 0) phoneWaiters.splice(idx, 1);
            }
            reject(new DOMException("Aborted", "AbortError"));
          };
          signal.addEventListener("abort", onAbort, {
            once: true,
          });
          let phoneWaiters = this.waiters.get(phoneNumber);
          if (!phoneWaiters) {
            phoneWaiters = [];
            this.waiters.set(phoneNumber, phoneWaiters);
          }
          waiter = (e) => {
            signal.removeEventListener("abort", onAbort);
            resolve(e);
          };
          phoneWaiters.push(waiter);
        });
        yield event;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        throw err;
      }
    }
  }
}
