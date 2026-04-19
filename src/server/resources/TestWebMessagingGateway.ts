import { ValidationException } from "~/infra/exceptions";
import type {
  ReceiveMessageDTO,
  SendInteractiveButtonMessageDTO,
  SendTextMessageDTO,
} from "~/server/resources/IMessagingGateway";
import type {
  IWebMessagingGateway,
  WebChatEvent,
  WebIncomingMessageBody,
} from "~/server/resources/IWebMessagingGateway";
import { ChatType } from "~/shared/entities/enums/ChatType";

export class TestWebMessagingGateway implements IWebMessagingGateway {
  private events: WebChatEvent[] = [];
  private mediaById = new Map<string, Buffer>();

  async receiveWebMessage(
    phoneNumber: string,
    body: unknown,
  ): Promise<ReceiveMessageDTO | undefined> {
    const parsedBody = this.parseIncomingMessageBody(body);

    if ("audioBuffer" in parsedBody) {
      const mediaId = crypto.randomUUID();
      this.mediaById.set(mediaId, parsedBody.audioBuffer);
      return {
        from: phoneNumber,
        mediaId,
        mimeType: parsedBody.mimeType,
        chatType: ChatType.Web,
        idProvider: crypto.randomUUID(),
      } as ReceiveMessageDTO;
    }
    if ("buttonReply" in parsedBody) {
      return {
        from: phoneNumber,
        buttonReply: parsedBody.buttonReply,
        chatType: ChatType.Web,
        idProvider: crypto.randomUUID(),
      } as ReceiveMessageDTO;
    }
    return {
      from: phoneNumber,
      text: parsedBody.text,
      chatType: ChatType.Web,
      idProvider: crypto.randomUUID(),
    } as ReceiveMessageDTO;
  }

  async sendTextMessage(dto: SendTextMessageDTO): Promise<void> {
    this.enqueue(dto.to, { type: "text", data: dto });
  }

  async sendInteractiveReplyButtonMessage(
    dto: SendInteractiveButtonMessageDTO,
  ): Promise<void> {
    this.enqueue(dto.to, { type: "interactive_button", data: dto });
  }

  async downloadMediaAsync(_mediaId: string): Promise<Buffer> {
    return Buffer.from("test-audio-content");
  }

  enqueue(_phoneNumber: string, event: WebChatEvent): void {
    this.events.push(event);
  }

  async *subscribe(
    _phoneNumber: string,
    signal: AbortSignal,
  ): AsyncGenerator<WebChatEvent> {
    while (!signal.aborted) {
      if (this.events.length > 0) {
        const event = this.events.shift();
        if (event) yield event;
        continue;
      }
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 100);
        signal.addEventListener(
          "abort",
          () => {
            clearTimeout(timeout);
            resolve();
          },
          { once: true },
        );
      });
    }
  }

  getEvents(): WebChatEvent[] {
    return [...this.events];
  }

  clearEvents(): void {
    this.events = [];
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
}
