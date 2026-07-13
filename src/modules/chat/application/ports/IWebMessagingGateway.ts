import type {
  IMessagingGateway,
  ReceiveMessageDTO,
} from "~/modules/chat/application/ports/IMessagingGateway";
import type { WebChatEvent } from "~/modules/chat/contracts/ChatContracts";

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

export interface IWebMessagingGateway extends IMessagingGateway {
  receiveWebMessage(
    webAddress: string,
    body: unknown,
  ): Promise<ReceiveMessageDTO | undefined>;
  enqueue(webAddress: string, event: WebChatEvent): void;
  subscribe(
    webAddress: string,
    signal: AbortSignal,
  ): AsyncGenerator<WebChatEvent>;
}
