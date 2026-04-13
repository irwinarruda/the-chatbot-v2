import type { IMessagingGateway } from "~/resources/IMessagingGateway";

export type WebChatEvent = {
  type: "text" | "interactive_button" | "audio" | "error";
  data: unknown;
};

export interface IWebMessagingGateway extends IMessagingGateway {
  saveMediaAsync(buffer: Buffer): Promise<string>;
  enqueue(phoneNumber: string, event: WebChatEvent): void;
  subscribe(
    phoneNumber: string,
    signal: AbortSignal,
  ): AsyncGenerator<WebChatEvent>;
}
