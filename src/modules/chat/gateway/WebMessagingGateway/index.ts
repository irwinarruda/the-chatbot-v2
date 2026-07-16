import type {
  MessagingGateway,
  ReceiveMessageDTO,
} from "~/modules/chat/gateway/MessagingGateway";

export type { WebIncomingMessageBodyDTO } from "~/modules/chat/gateway/MessagingGateway";

export interface WebMessagingGateway extends MessagingGateway {
  receiveWebMessage(
    webAddress: string,
    body: unknown,
  ): Promise<ReceiveMessageDTO | undefined>;
}
