import type {
  AiChatContext,
  AiChatMessage,
  AiChatResponse,
  IAiChatGateway,
} from "~/server/resources/IAiChatGateway";
import {
  AiChatMessageType,
  AiChatRole,
} from "~/server/resources/IAiChatGateway";

export class TestAiChatGateway implements IAiChatGateway {
  lastChannelAddress?: string;
  lastContext?: AiChatContext;

  async getResponse(
    channelAddress: string,
    messages: AiChatMessage[],
    _allowTools?: boolean,
    context?: AiChatContext,
  ): Promise<AiChatResponse> {
    this.lastChannelAddress = channelAddress;
    this.lastContext = context;
    const lastMessage =
      [...messages]
        .reverse()
        .find((m: AiChatMessage) => m.role === AiChatRole.User)?.text ?? "";
    return {
      text: `Response to: ${lastMessage.trim()}`,
      type: AiChatMessageType.Text,
      buttons: [],
    };
  }

  async generateSummary(
    messages: AiChatMessage[],
    existingSummary: string | undefined,
  ): Promise<string> {
    let summary = `Summary of ${messages.length} messages`;
    if (existingSummary) {
      summary = `${existingSummary} + ${summary}`;
    }
    return summary;
  }
}
