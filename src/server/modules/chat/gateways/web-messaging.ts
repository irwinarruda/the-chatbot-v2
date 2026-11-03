import type { MessagingGateway, ReceiveMessageDTO } from "./messaging";

export type { WebIncomingMessageBodyDTO } from "./messaging";

export interface WebMessagingGateway extends MessagingGateway {
  receiveWebMessage(
    webAddress: string,
    body: unknown,
  ): Promise<ReceiveMessageDTO | undefined>;
}
