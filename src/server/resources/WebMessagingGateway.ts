import { NotFoundException, ValidationException } from "~/infra/exceptions";
import type {
  ReceiveAudioMessageDTO,
  ReceiveInteractiveButtonMessageDTO,
  ReceiveMessageDTO,
  ReceiveTextMessageDTO,
  SendInteractiveButtonMessageDTO,
  SendTextMessageDTO,
} from "~/server/resources/IMessagingGateway";
import type {
  IWebMessagingGateway,
  WebChatEvent,
  WebIncomingMessageBody,
} from "~/server/resources/IWebMessagingGateway";
import { ChatType } from "~/shared/entities/enums/ChatType";

export class WebMessagingGateway implements IWebMessagingGateway {
  private readonly mediaById = new Map<string, Buffer>();
  private readonly subscribers = new Map<string, Set<WebEventSubscriber>>();
  private readonly queues = new Map<string, WebChatEvent[]>();

  async receiveWebMessage(
    phoneNumber: string,
    body: unknown,
  ): Promise<ReceiveMessageDTO | undefined> {
    const parsedBody = this.parseIncomingMessageBody(body);
    if ("audioBuffer" in parsedBody) {
      return this.createAudioMessage(phoneNumber, parsedBody);
    }
    if ("buttonReply" in parsedBody) {
      return this.createButtonReplyMessage(phoneNumber, parsedBody.buttonReply);
    }
    return this.createTextMessage(phoneNumber, parsedBody.text);
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
    const subscribers = this.subscribers.get(phoneNumber);
    if (!subscribers?.size) {
      this.getOrCreateQueue(phoneNumber).push(event);
      return;
    }
    for (const subscriber of subscribers) {
      if (subscriber.pending) {
        const pending = subscriber.pending;
        subscriber.pending = undefined;
        pending.resolve(event);
        continue;
      }
      subscriber.queue.push(event);
    }
  }

  async *subscribe(
    phoneNumber: string,
    signal: AbortSignal,
  ): AsyncGenerator<WebChatEvent> {
    const subscriber = this.addSubscriber(phoneNumber);
    try {
      while (!signal.aborted) {
        const event = await this.nextEvent(subscriber, signal);
        if (!event) return;
        yield event;
      }
    } finally {
      this.removeSubscriber(phoneNumber, subscriber);
    }
  }

  private createTextMessage(
    phoneNumber: string,
    text: string,
  ): ReceiveTextMessageDTO {
    return {
      ...this.createBaseReceiveMessage(phoneNumber),
      text,
    };
  }

  private createButtonReplyMessage(
    phoneNumber: string,
    buttonReply: string,
  ): ReceiveInteractiveButtonMessageDTO {
    return {
      ...this.createBaseReceiveMessage(phoneNumber),
      buttonReply,
    };
  }

  private createAudioMessage(
    phoneNumber: string,
    body: Extract<WebIncomingMessageBody, { audioBuffer: Buffer }>,
  ): ReceiveAudioMessageDTO {
    const mediaId = crypto.randomUUID();
    this.mediaById.set(mediaId, body.audioBuffer);
    return {
      ...this.createBaseReceiveMessage(phoneNumber),
      mediaId,
      mimeType: body.mimeType,
    };
  }

  private createBaseReceiveMessage(phoneNumber: string): ReceiveMessageDTO {
    return {
      from: phoneNumber,
      chatType: ChatType.Web,
      idProvider: crypto.randomUUID(),
    };
  }

  private parseIncomingMessageBody(body: unknown): WebIncomingMessageBody {
    if (!body || typeof body !== "object") {
      throw new ValidationException(
        "Request body must be a JSON object",
        "Provide a text, button reply, or audio payload.",
      );
    }
    const payload = body as Record<string, unknown>;
    if ("audioBuffer" in payload || "mimeType" in payload) {
      if (
        Buffer.isBuffer(payload.audioBuffer) &&
        typeof payload.mimeType === "string"
      ) {
        return {
          audioBuffer: payload.audioBuffer,
          mimeType: payload.mimeType,
        };
      }
      throw new ValidationException(
        "Request body must contain a valid web audio payload",
        "Provide a valid audioBuffer and mimeType payload.",
      );
    }
    if ("text" in payload && typeof payload.text === "string") {
      return { text: payload.text };
    }
    if ("buttonReply" in payload && typeof payload.buttonReply === "string") {
      return { buttonReply: payload.buttonReply };
    }
    throw new ValidationException(
      "Request body must contain a valid web message payload",
      "Provide either a text, button reply, or audio payload.",
    );
  }

  private addSubscriber(phoneNumber: string): WebEventSubscriber {
    const subscriber: WebEventSubscriber = {
      queue: this.takeQueuedEvents(phoneNumber),
    };
    this.getOrCreateSubscribers(phoneNumber).add(subscriber);
    return subscriber;
  }

  private removeSubscriber(
    phoneNumber: string,
    subscriber: WebEventSubscriber,
  ): void {
    subscriber.pending?.cancel();
    const subscribers = this.subscribers.get(phoneNumber);
    if (!subscribers) return;
    subscribers.delete(subscriber);
    if (subscribers.size === 0) {
      this.subscribers.delete(phoneNumber);
    }
  }

  private async nextEvent(
    subscriber: WebEventSubscriber,
    signal: AbortSignal,
  ): Promise<WebChatEvent | undefined> {
    const event = subscriber.queue.shift();
    if (event) {
      return event;
    }
    return this.waitForNextEvent(subscriber, signal);
  }

  private waitForNextEvent(
    subscriber: WebEventSubscriber,
    signal: AbortSignal,
  ): Promise<WebChatEvent | undefined> {
    if (signal.aborted) {
      return Promise.resolve(undefined);
    }
    return new Promise((resolve) => {
      const clearPending = () => {
        subscriber.pending = undefined;
        signal.removeEventListener("abort", onAbort);
      };
      const onAbort = () => {
        clearPending();
        resolve(undefined);
      };
      subscriber.pending = {
        resolve: (event) => {
          clearPending();
          resolve(event);
        },
        cancel: () => {
          clearPending();
          resolve(undefined);
        },
      };
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  private getOrCreateQueue(phoneNumber: string): WebChatEvent[] {
    let queue = this.queues.get(phoneNumber);
    if (!queue) {
      queue = [];
      this.queues.set(phoneNumber, queue);
    }

    return queue;
  }

  private takeQueuedEvents(phoneNumber: string): WebChatEvent[] {
    const queue = this.queues.get(phoneNumber) ?? [];
    this.queues.delete(phoneNumber);
    return queue;
  }

  private getOrCreateSubscribers(phoneNumber: string): Set<WebEventSubscriber> {
    let subscribers = this.subscribers.get(phoneNumber);
    if (!subscribers) {
      subscribers = new Set();
      this.subscribers.set(phoneNumber, subscribers);
    }

    return subscribers;
  }
}

interface WebEventSubscriber {
  queue: WebChatEvent[];
  pending?: WebEventPending;
}

interface WebEventPending {
  resolve(event: WebChatEvent): void;
  cancel(): void;
}
