import type { ChatType } from "~/entities/enums/ChatType";

export interface SendTextMessageDTO {
  to: string;
  text: string;
}

export interface SendInteractiveButtonMessageDTO {
  to: string;
  text: string;
  buttons: string[];
}

export interface ReceiveMessageDTO {
  from: string;
  idProvider: string;
  chatType: ChatType;
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
