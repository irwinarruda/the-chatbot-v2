import type {
  IMessagingGateway,
  ReceiveMessageDTO,
} from "~/server/resources/IMessagingGateway";
import type { WebChatEvent } from "~/shared/types/web-chat";

export type { WebChatEvent } from "~/shared/types/web-chat";

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
    phoneNumber: string,
    body: unknown,
  ): Promise<ReceiveMessageDTO | undefined>;
  enqueue(phoneNumber: string, event: WebChatEvent): void;
  subscribe(
    phoneNumber: string,
    signal: AbortSignal,
  ): AsyncGenerator<WebChatEvent>;
}
