import type { ChatChannel } from "~/modules/chat/domain/enums/ChatChannel";

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
  whatsAppBsuid?: string;
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
