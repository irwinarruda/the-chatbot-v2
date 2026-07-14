import type {
  MessagingGateway,
  ReceiveMessageDTO,
} from "~/modules/chat/gateway/MessagingGateway";

export type WebIncomingMessageBody =
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

export interface WebMessagingGateway extends MessagingGateway {
  receiveWebMessage(
    webAddress: string,
    body: unknown,
  ): Promise<ReceiveMessageDTO | undefined>;
}
