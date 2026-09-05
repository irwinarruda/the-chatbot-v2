import type { ChatChannel } from "~/modules/chat/entities/enums/ChatChannel";

export interface SendTextMessageDTO {
  toAddress: string;
  text: string;
}

export interface SendInteractiveButtonMessageDTO {
  toAddress: string;
  text: string;
  buttons: string[];
}

export interface ReceiveMessageMetadataDTO {
  fromAddress: string;
  whatsAppBsuid?: string;
  channelMessageId: string;
  channel: ChatChannel;
}

export interface ReceiveTextMessageDTO extends ReceiveMessageMetadataDTO {
  text: string;
}

export interface ReceiveInteractiveButtonMessageDTO
  extends ReceiveMessageMetadataDTO {
  buttonReply: string;
}

export interface ReceiveAudioMessageDTO extends ReceiveMessageMetadataDTO {
  mediaId: string;
  mimeType: string;
}

export type ReceiveMessageDTO =
  | ReceiveTextMessageDTO
  | ReceiveInteractiveButtonMessageDTO
  | ReceiveAudioMessageDTO;

export type WebIncomingMessageBodyDTO =
  | {
      text: string;
      clientMessageId: string;
    }
  | {
      buttonReply: string;
      clientMessageId: string;
    }
  | {
      audioBuffer: Buffer;
      mimeType: string;
      clientMessageId: string;
    };

export interface SendMessageRecipientDTO {
  channel: ChatChannel;
  toAddress: string;
}
