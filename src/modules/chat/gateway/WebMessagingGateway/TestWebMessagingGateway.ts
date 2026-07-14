import { ChatChannel } from "~/modules/chat/entities/enums/ChatChannel";
import type {
  ReceiveMessageDTO,
  SendInteractiveButtonMessageDTO,
  SendTextMessageDTO,
} from "~/modules/chat/gateway/MessagingGateway";
import type {
  WebIncomingMessageBody,
  WebMessagingGateway,
} from "~/modules/chat/gateway/WebMessagingGateway";
import { ValidationException } from "~/shared/errors/DomainErrors";

export class TestWebMessagingGateway implements WebMessagingGateway {
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
