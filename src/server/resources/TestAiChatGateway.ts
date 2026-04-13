import type {
  AiChatMessage,
  AiChatResponse,
  IAiChatGateway,
} from "~/server/resources/IAiChatGateway";
import {
  AiChatMessageType,
  AiChatRole,
} from "~/server/resources/IAiChatGateway";

export class TestAiChatGateway implements IAiChatGateway {
  async getResponse(
    _phoneNumber: string,
    messages: AiChatMessage[],
    _allowTools?: boolean,
  ): Promise<AiChatResponse> {
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
