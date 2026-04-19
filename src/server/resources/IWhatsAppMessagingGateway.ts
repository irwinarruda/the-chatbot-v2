import type { IMessagingGateway, ReceiveMessageDTO } from "./IMessagingGateway";

export type {
  IMessagingGateway,
  ReceiveAudioMessageDTO,
  ReceiveInteractiveButtonMessageDTO,
  ReceiveMessageDTO,
  ReceiveTextMessageDTO,
  SendInteractiveButtonMessageDTO,
  SendTextMessageDTO,
} from "./IMessagingGateway";

export interface IWhatsAppMessagingGateway extends IMessagingGateway {
  validateSignature(signature: string, rawBody: string): boolean;
  validateWebhook(hubMode: string, hubVerifyToken: string): boolean;
  receiveWhatsAppMessage(data: unknown): ReceiveMessageDTO | undefined;
}
