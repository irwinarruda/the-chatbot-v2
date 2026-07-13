import type {
  ReceiveMessageDTO,
  SendInteractiveButtonMessageDTO,
  SendTextMessageDTO,
} from "~/modules/chat/application/ports/IMessagingGateway";
import type {
  IWebMessagingGateway,
  WebIncomingMessageBody,
} from "~/modules/chat/application/ports/IWebMessagingGateway";
import type { WebChatEvent } from "~/modules/chat/contracts/ChatContracts";
import { ChatChannel } from "~/modules/chat/domain/enums/ChatChannel";
import { ValidationException } from "~/shared/errors/DomainErrors";

export class TestWebMessagingGateway implements IWebMessagingGateway {
  private events: WebChatEvent[] = [];
  private mediaById = new Map<string, Buffer>();

  async receiveWebMessage(
    webAddress: string,
    body: unknown,
  ): Promise<ReceiveMessageDTO | undefined> {
    const parsedBody = this.parseIncomingMessageBody(body);
    if ("audioBuffer" in parsedBody) {
      const mediaId = crypto.randomUUID();
      this.mediaById.set(mediaId, parsedBody.audioBuffer);
      return {
        ...this.createBaseReceiveMessage(
          webAddress,
          parsedBody.clientMessageId,
        ),
        mediaId,
        mimeType: parsedBody.mimeType,
      } as ReceiveMessageDTO;
    }
    if ("buttonReply" in parsedBody) {
      return {
        ...this.createBaseReceiveMessage(
          webAddress,
          parsedBody.clientMessageId,
        ),
        buttonReply: parsedBody.buttonReply,
      } as ReceiveMessageDTO;
    }
    return {
      ...this.createBaseReceiveMessage(webAddress, parsedBody.clientMessageId),
      text: parsedBody.text,
    } as ReceiveMessageDTO;
  }

  async sendTextMessage(dto: SendTextMessageDTO): Promise<void> {
    void dto;
  }

  async sendInteractiveReplyButtonMessage(
    dto: SendInteractiveButtonMessageDTO,
  ): Promise<void> {
    void dto;
  }

  async downloadMediaAsync(_mediaId: string): Promise<Buffer> {
    return Buffer.from("test-audio-content");
  }

  enqueue(_webAddress: string, event: WebChatEvent): void {
    this.events.push(event);
  }

  async *subscribe(
    _webAddress: string,
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

  private createBaseReceiveMessage(
    webAddress: string,
    channelMessageId: string = crypto.randomUUID(),
  ): ReceiveMessageDTO {
    return {
      fromAddress: webAddress.toLowerCase(),
      channel: ChatChannel.Web,
      channelMessageId,
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
          clientMessageId:
            typeof payload.clientMessageId === "string"
              ? payload.clientMessageId
              : crypto.randomUUID(),
        };
      }
      throw new ValidationException(
        "Request body must contain a valid web audio payload",
        "Provide a valid audioBuffer and mimeType payload.",
      );
    }
    if ("text" in payload && typeof payload.text === "string") {
      return {
        text: payload.text,
        clientMessageId:
          typeof payload.clientMessageId === "string"
            ? payload.clientMessageId
            : crypto.randomUUID(),
      };
    }
    if ("buttonReply" in payload && typeof payload.buttonReply === "string") {
      return {
        buttonReply: payload.buttonReply,
        clientMessageId:
          typeof payload.clientMessageId === "string"
            ? payload.clientMessageId
            : crypto.randomUUID(),
      };
    }
    throw new ValidationException(
      "Request body must contain a valid web message payload",
      "Provide either a text, button reply, or audio payload.",
    );
  }
}
