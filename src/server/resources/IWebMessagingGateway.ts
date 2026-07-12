import type {
  IMessagingGateway,
  ReceiveMessageDTO,
} from "~/server/resources/IMessagingGateway";
import type { WebChatEvent } from "~/shared/entities/events/WebChatEvent";

export type WebIncomingMessageBody =
  | {
      text: string;
    }
  | {
      buttonReply: string;
    }
  | {
      audioBuffer: Buffer;
      mimeType: string;
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
