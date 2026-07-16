import { ChatChannel } from "~/modules/chat/entities/enums/ChatChannel";
import type {
  ReceiveAudioMessageDTO,
  ReceiveInteractiveButtonMessageDTO,
  ReceiveMessageDTO,
  ReceiveTextMessageDTO,
  SendInteractiveButtonMessageDTO,
  SendTextMessageDTO,
} from "~/modules/chat/gateway/MessagingGateway";
import type {
  WebIncomingMessageBodyDTO,
  WebMessagingGateway,
} from "~/modules/chat/gateway/WebMessagingGateway";
import { NotFoundException } from "~/shared/errors/ApplicationErrors";
import { ValidationException } from "~/shared/errors/DomainErrors";

export class LocalWebMessagingGateway implements WebMessagingGateway {
  private readonly mediaById = new Map<string, Buffer>();

  async receiveWebMessage(
    webAddress: string,
    body: unknown,
  ): Promise<ReceiveMessageDTO | undefined> {
    const parsedBody = this.parseIncomingMessageBody(body);
    if ("audioBuffer" in parsedBody) {
      return this.createAudioMessage(webAddress, parsedBody);
    }
    if ("buttonReply" in parsedBody) {
      return this.createButtonReplyMessage(
        webAddress,
        parsedBody.buttonReply,
        parsedBody.clientMessageId,
      );
    }
    return this.createTextMessage(
      webAddress,
      parsedBody.text,
      parsedBody.clientMessageId,
    );
  }

  async sendTextMessage(dto: SendTextMessageDTO): Promise<void> {
    void dto;
  }

  async sendInteractiveReplyButtonMessage(
    dto: SendInteractiveButtonMessageDTO,
  ): Promise<void> {
    void dto;
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

  private createTextMessage(
    webAddress: string,
    text: string,
    clientMessageId: string,
  ): ReceiveTextMessageDTO {
    return {
      ...this.createBaseReceiveMessage(webAddress, clientMessageId),
      text,
    };
  }

  private createButtonReplyMessage(
    webAddress: string,
    buttonReply: string,
    clientMessageId: string,
  ): ReceiveInteractiveButtonMessageDTO {
    return {
      ...this.createBaseReceiveMessage(webAddress, clientMessageId),
      buttonReply,
    };
  }

  private createAudioMessage(
    webAddress: string,
    body: Extract<WebIncomingMessageBodyDTO, { audioBuffer: Buffer }>,
  ): ReceiveAudioMessageDTO {
    const mediaId = crypto.randomUUID();
    this.mediaById.set(mediaId, body.audioBuffer);
    return {
      ...this.createBaseReceiveMessage(webAddress, body.clientMessageId),
      mediaId,
      mimeType: body.mimeType,
    };
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

  private parseIncomingMessageBody(body: unknown): WebIncomingMessageBodyDTO {
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
        typeof payload.mimeType === "string" &&
        typeof payload.clientMessageId === "string"
      ) {
        return {
          audioBuffer: payload.audioBuffer,
          mimeType: payload.mimeType,
          clientMessageId: payload.clientMessageId,
        };
      }
      throw new ValidationException(
        "Request body must contain a valid web audio payload",
        "Provide a valid audioBuffer and mimeType payload.",
      );
    }
    if (
      "text" in payload &&
      typeof payload.text === "string" &&
      typeof payload.clientMessageId === "string"
    ) {
      return { text: payload.text, clientMessageId: payload.clientMessageId };
    }
    if (
      "buttonReply" in payload &&
      typeof payload.buttonReply === "string" &&
      typeof payload.clientMessageId === "string"
    ) {
      return {
        buttonReply: payload.buttonReply,
        clientMessageId: payload.clientMessageId,
      };
    }
    throw new ValidationException(
      "Request body must contain a valid web message payload",
      "Provide either a text, button reply, or audio payload.",
    );
  }
}
