export const AiChatRole = {
  System: "system",
  User: "user",
  Assistant: "assistant",
} as const;
export type AiChatRole = ValueOf<typeof AiChatRole>;

export const AiChatMessageType = {
  Text: "text",
  Button: "button",
} as const;
export type AiChatMessageType = ValueOf<typeof AiChatMessageType>;

export interface AiChatMessage {
  role: AiChatRole;
  type: AiChatMessageType;
  text: string;
  buttons?: string[];
}

export interface AiChatResponse {
  type: AiChatMessageType;
  text: string;
  buttons: string[];
}

export interface AiChatContext {
  idSourceMessage?: string;
  [key: string]: unknown;
}

export interface IAiChatGateway {
  getResponse(
    channelAddress: string,
    messages: AiChatMessage[],
    allowTools?: boolean,
    context?: AiChatContext,
  ): Promise<AiChatResponse>;
  generateSummary(
    messages: AiChatMessage[],
    existingSummary: string | undefined,
  ): Promise<string>;
}
