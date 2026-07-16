import type {
  SendInteractiveButtonMessageDTO,
  SendTextMessageDTO,
} from "~/modules/chat/entities/dtos/MessagingGatewayDTO";

export type {
  ReceiveAudioMessageDTO,
  ReceiveInteractiveButtonMessageDTO,
  ReceiveMessageDTO,
  ReceiveTextMessageDTO,
  SendInteractiveButtonMessageDTO,
  SendMessageRecipientDTO,
  SendTextMessageDTO,
  WebIncomingMessageBodyDTO,
} from "~/modules/chat/entities/dtos/MessagingGatewayDTO";

export interface MessagingGateway {
  sendTextMessage(dto: SendTextMessageDTO): Promise<void>;
  sendInteractiveReplyButtonMessage(
    dto: SendInteractiveButtonMessageDTO,
  ): Promise<void>;
  downloadMediaAsync(mediaId: string): Promise<Buffer>;
}
