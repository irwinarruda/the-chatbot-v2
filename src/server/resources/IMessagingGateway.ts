import type { ChatChannel } from "~/shared/entities/enums/ChatChannel";

export interface SendTextMessageDTO {
  toAddress: string;
  text: string;
}

export interface SendInteractiveButtonMessageDTO {
  toAddress: string;
  text: string;
  buttons: string[];
}

export interface ReceiveMessageDTO {
  fromAddress: string;
  /** @deprecated WhatsApp-only fallback while phone-based identities are migrated. */
  whatsAppPhoneNumber?: string;
  channelMessageId: string;
  channel: ChatChannel;
}

export interface ReceiveTextMessageDTO extends ReceiveMessageDTO {
  text: string;
}

export interface ReceiveInteractiveButtonMessageDTO extends ReceiveMessageDTO {
  buttonReply: string;
}

export interface ReceiveAudioMessageDTO extends ReceiveMessageDTO {
  mediaId: string;
  mimeType: string;
}

export interface IMessagingGateway {
  sendTextMessage(dto: SendTextMessageDTO): Promise<void>;
  sendInteractiveReplyButtonMessage(
    dto: SendInteractiveButtonMessageDTO,
  ): Promise<void>;
  downloadMediaAsync(mediaId: string): Promise<Buffer>;
}
