import { ChatType } from "~/entities/enums/ChatType";
import { NotFoundException } from "~/infra/exceptions";
import type {
  ReceiveInteractiveButtonMessageDTO,
  ReceiveMessageDTO,
  ReceiveTextMessageDTO,
  SendInteractiveButtonMessageDTO,
  SendTextMessageDTO,
} from "~/resources/IMessagingGateway";
import type {
  IWebMessagingGateway,
  WebChatEvent,
} from "~/resources/IWebMessagingGateway";

export class WebMessagingGateway implements IWebMessagingGateway {
  private mediaById = new Map<string, Buffer>();
  private subscribers = new Map<string, Set<WebEventSubscriber>>();
  private queues = new Map<string, WebChatEvent[]>();

  async receiveWebMessage(
    phoneNumber: string,
    body: unknown,
  ): Promise<ReceiveMessageDTO | undefined> {
    const data = body as {
      text?: string;
      buttonReply?: string;
      audioBuffer?: Buffer;
      mimeType?: string;
    };
    if (data.audioBuffer && data.mimeType) {
      const mediaId = crypto.randomUUID();
      this.mediaById.set(mediaId, data.audioBuffer);
      return {
        from: phoneNumber,
        mediaId,
        mimeType: data.mimeType,
        chatType: ChatType.Web,
        idProvider: crypto.randomUUID(),
      } as ReceiveMessageDTO;
    }
    if (data.buttonReply) {
      const dto: ReceiveInteractiveButtonMessageDTO = {
        from: phoneNumber,
        buttonReply: data.buttonReply,
        chatType: ChatType.Web,
        idProvider: crypto.randomUUID(),
      };
      return dto;
    }
    const dto: ReceiveTextMessageDTO = {
      from: phoneNumber,
      text: data.text ?? "",
      chatType: ChatType.Web,
      idProvider: crypto.randomUUID(),
    };
    return dto;
  }

  async sendTextMessage(dto: SendTextMessageDTO): Promise<void> {
    this.enqueue(dto.to, { type: "text", data: dto });
  }

  async sendInteractiveReplyButtonMessage(
    dto: SendInteractiveButtonMessageDTO,
  ): Promise<void> {
    this.enqueue(dto.to, { type: "interactive_button", data: dto });
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
    const phoneSubscribers = this.subscribers.get(phoneNumber);
    if (phoneSubscribers && phoneSubscribers.size > 0) {
      for (const subscriber of phoneSubscribers) {
        if (subscriber.resolve) {
          const resolve = subscriber.resolve;
          subscriber.resolve = undefined;
          subscriber.reject = undefined;
          resolve(event);
          continue;
        }
        subscriber.queue.push(event);
      }
      return;
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
    const subscriber: WebEventSubscriber = {
      queue: this.queues.get(phoneNumber) ?? [],
      resolve: undefined,
      reject: undefined,
    };
    this.queues.delete(phoneNumber);

    let phoneSubscribers = this.subscribers.get(phoneNumber);
    if (!phoneSubscribers) {
      phoneSubscribers = new Set();
      this.subscribers.set(phoneNumber, phoneSubscribers);
    }
    phoneSubscribers.add(subscriber);

    const onAbort = () => {
      if (!subscriber.reject) return;
      const reject = subscriber.reject;
      subscriber.resolve = undefined;
      subscriber.reject = undefined;
      reject(new DOMException("Aborted", "AbortError"));
    };

    signal.addEventListener("abort", onAbort, { once: true });

    try {
      while (!signal.aborted) {
        const event = subscriber.queue.shift();
        if (event) {
          yield event;
          continue;
        }

        try {
          const nextEvent = await new Promise<WebChatEvent>(
            (resolve, reject) => {
              subscriber.resolve = (event) => {
                subscriber.resolve = undefined;
                subscriber.reject = undefined;
                resolve(event);
              };
              subscriber.reject = (error) => {
                subscriber.resolve = undefined;
                subscriber.reject = undefined;
                reject(error);
              };
            },
          );
          yield nextEvent;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }
          throw err;
        }
      }
    } finally {
      signal.removeEventListener("abort", onAbort);
      phoneSubscribers.delete(subscriber);
      if (phoneSubscribers.size === 0) {
        this.subscribers.delete(phoneNumber);
      }
    }
  }
}

interface WebEventSubscriber {
  queue: WebChatEvent[];
  resolve: ((event: WebChatEvent) => void) | undefined;
  reject: ((reason: Error) => void) | undefined;
}
