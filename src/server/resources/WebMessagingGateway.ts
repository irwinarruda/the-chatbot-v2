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
import { ChatChannel } from "~/shared/entities/enums/ChatChannel";

export class WebMessagingGateway implements IWebMessagingGateway {
  private readonly mediaById = new Map<string, Buffer>();
  private readonly subscribers = new Map<string, Set<WebEventSubscriber>>();
  private readonly queues = new Map<string, WebChatEvent[]>();

  async receiveWebMessage(
    webAddress: string,
    body: unknown,
  ): Promise<ReceiveMessageDTO | undefined> {
    const parsedBody = this.parseIncomingMessageBody(body);
    if ("audioBuffer" in parsedBody) {
      return this.createAudioMessage(webAddress, parsedBody);
    }
    if ("buttonReply" in parsedBody) {
      return this.createButtonReplyMessage(webAddress, parsedBody.buttonReply);
    }
    return this.createTextMessage(webAddress, parsedBody.text);
  }

  async sendTextMessage(dto: SendTextMessageDTO): Promise<void> {
    this.enqueue(dto.toAddress, { type: "text", data: dto });
  }

  async sendInteractiveReplyButtonMessage(
    dto: SendInteractiveButtonMessageDTO,
  ): Promise<void> {
    this.enqueue(dto.toAddress, { type: "interactive_button", data: dto });
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

  enqueue(webAddress: string, event: WebChatEvent): void {
    const subscribers = this.subscribers.get(webAddress);
    if (!subscribers?.size) {
      this.getOrCreateQueue(webAddress).push(event);
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
    webAddress: string,
    signal: AbortSignal,
  ): AsyncGenerator<WebChatEvent> {
    const subscriber = this.addSubscriber(webAddress);
    try {
      while (!signal.aborted) {
        const event = await this.nextEvent(subscriber, signal);
        if (!event) return;
        yield event;
      }
    } finally {
      this.removeSubscriber(webAddress, subscriber);
    }
  }

  private createTextMessage(
    webAddress: string,
    text: string,
  ): ReceiveTextMessageDTO {
    return {
      ...this.createBaseReceiveMessage(webAddress),
      text,
    };
  }

  private createButtonReplyMessage(
    webAddress: string,
    buttonReply: string,
  ): ReceiveInteractiveButtonMessageDTO {
    return {
      ...this.createBaseReceiveMessage(webAddress),
      buttonReply,
    };
  }

  private createAudioMessage(
    webAddress: string,
    body: Extract<WebIncomingMessageBody, { audioBuffer: Buffer }>,
  ): ReceiveAudioMessageDTO {
    const mediaId = crypto.randomUUID();
    this.mediaById.set(mediaId, body.audioBuffer);
    return {
      ...this.createBaseReceiveMessage(webAddress),
      mediaId,
      mimeType: body.mimeType,
    };
  }

  private createBaseReceiveMessage(webAddress: string): ReceiveMessageDTO {
    return {
      fromAddress: webAddress.toLowerCase(),
      channel: ChatChannel.Web,
      channelMessageId: crypto.randomUUID(),
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

  private addSubscriber(webAddress: string): WebEventSubscriber {
    const subscriber: WebEventSubscriber = {
      queue: this.takeQueuedEvents(webAddress),
    };
    this.getOrCreateSubscribers(webAddress).add(subscriber);
    return subscriber;
  }

  private removeSubscriber(
    webAddress: string,
    subscriber: WebEventSubscriber,
  ): void {
    subscriber.pending?.cancel();
    const subscribers = this.subscribers.get(webAddress);
    if (!subscribers) return;
    subscribers.delete(subscriber);
    if (subscribers.size === 0) {
      this.subscribers.delete(webAddress);
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

  private getOrCreateQueue(webAddress: string): WebChatEvent[] {
    let queue = this.queues.get(webAddress);
    if (!queue) {
      queue = [];
      this.queues.set(webAddress, queue);
    }
    return queue;
  }

  private takeQueuedEvents(webAddress: string): WebChatEvent[] {
    const queue = this.queues.get(webAddress) ?? [];
    this.queues.delete(webAddress);
    return queue;
  }

  private getOrCreateSubscribers(webAddress: string): Set<WebEventSubscriber> {
    let subscribers = this.subscribers.get(webAddress);
    if (!subscribers) {
      subscribers = new Set();
      this.subscribers.set(webAddress, subscribers);
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
