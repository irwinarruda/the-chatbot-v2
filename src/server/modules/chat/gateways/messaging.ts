import type {
  SendInteractiveButtonMessageDTO,
  SendTextMessageDTO,
} from "~/domain/chat/messaging";

export type {
  ReceiveAudioMessageDTO,
  ReceiveInteractiveButtonMessageDTO,
  ReceiveMessageDTO,
  ReceiveMessageMetadataDTO,
  ReceiveTextMessageDTO,
  SendInteractiveButtonMessageDTO,
  SendMessageRecipientDTO,
  SendTextMessageDTO,
  WebIncomingMessageBodyDTO,
} from "~/domain/chat/messaging";

export interface MessagingGateway {
  sendTextMessage(dto: SendTextMessageDTO): Promise<void>;
  sendInteractiveReplyButtonMessage(
    dto: SendInteractiveButtonMessageDTO,
  ): Promise<void>;
  downloadMediaAsync(mediaId: string): Promise<Buffer>;
}
