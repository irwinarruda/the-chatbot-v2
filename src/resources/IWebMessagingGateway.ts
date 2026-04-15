import type {
  IMessagingGateway,
  ReceiveMessageDTO,
} from "~/resources/IMessagingGateway";

export type WebChatEvent = {
  type: "text" | "interactive_button" | "audio" | "error";
  data: unknown;
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
