import type { MessagingGateway, ReceiveMessageDTO } from "./messaging";

export type {
  MessagingGateway,
  ReceiveAudioMessageDTO,
  ReceiveInteractiveButtonMessageDTO,
  ReceiveMessageDTO,
  ReceiveTextMessageDTO,
  SendInteractiveButtonMessageDTO,
  SendTextMessageDTO,
} from "./messaging";

export interface WhatsAppMessagingGateway extends MessagingGateway {
  validateSignature(signature: string, rawBody: string): boolean;
  validateWebhook(hubMode: string, hubVerifyToken: string): boolean;
  receiveWhatsAppMessage(data: unknown): ReceiveMessageDTO | undefined;
}
