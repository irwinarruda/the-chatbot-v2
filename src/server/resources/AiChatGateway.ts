import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { AiConfig } from "~/infra/config";
import { executeTool, toolDefinitions } from "~/server/resources/ai-chat-tools";
import type {
  AiChatMessage,
  AiChatResponse,
  IAiChatGateway,
} from "~/server/resources/IAiChatGateway";
import {
  AiChatMessageType,
  AiChatRole,
} from "~/server/resources/IAiChatGateway";
import type { AuthService } from "~/server/services/AuthService";
import type { CashFlowService } from "~/server/services/CashFlowService";
import { PromptLoader, PromptLocale } from "~/server/utils/PromptLoader";

export class AiChatGateway implements IAiChatGateway {
  private openai: OpenAI | undefined = undefined;
  private anthropic: Anthropic | undefined = undefined;

  constructor(
    private config: AiConfig,
    private cashFlowService: CashFlowService,
    private authService: AuthService,
  ) {
    if (config.provider === "openai") {
      this.openai = new OpenAI({ apiKey: config.apiKey });
    } else {
      this.anthropic = new Anthropic({ apiKey: config.apiKey });
    }
  }

  private formatMessages(messages: AiChatMessage[]) {
    return messages.map((m) => {
      let text = m.text;
      if (m.role === AiChatRole.Assistant) {
        text =
          m.type === AiChatMessageType.Button
            ? `[Button][${(m.buttons ?? []).join(";")}]${m.text}`.trim()
            : `[Text]${m.text}`.trim();
      }
      return { role: m.role as string, content: text };
    });
  }

  private parseResponse(raw: string): AiChatResponse {
    const llmResponse: AiChatResponse = {
      type: AiChatMessageType.Text,
      text: raw,
      buttons: [],
    };

    if (!raw) return llmResponse;

    const buttonMatch = raw.match(
      /^\s*\[(Button)\]\s*\[(?<btns>[^\]]+)\](?<rest>.*)$/is,
    );
    if (buttonMatch?.groups) {
      llmResponse.type = AiChatMessageType.Button;
      llmResponse.text = buttonMatch.groups.rest?.trim() ?? "";
      llmResponse.buttons = buttonMatch.groups.btns
        .split(";")
        .map((b) => b.trim())
        .filter((b) => b.length > 0)
        .slice(0, 3);
      return llmResponse;
    }

    const textMatch = raw.match(/^\s*\[(Text)\](?<rest>.*)$/is);
    if (textMatch?.groups) {
      llmResponse.text = textMatch.groups.rest?.trim() ?? "";
      return llmResponse;
    }

    return llmResponse;
  }

  async getResponse(
    phoneNumber: string,
    messages: AiChatMessage[],
    allowTools = true,
  ): Promise<AiChatResponse> {
    const systemPrompt = PromptLoader.getAiChatGateway(PromptLocale.PtBr, {
      phoneNumber,
    });
    const formattedMessages = this.formatMessages(messages);

    let raw = "";
    if (this.openai) {
      raw = await this.getOpenAiResponse(
        systemPrompt,
        formattedMessages,
        allowTools,
      );
    } else if (this.anthropic) {
      raw = await this.getAnthropicResponse(
        systemPrompt,
        formattedMessages,
        allowTools,
      );
    }

    return this.parseResponse(raw);
  }

  private async getOpenAiResponse(
    systemPrompt: string,
    formattedMessages: { role: string; content: string }[],
    allowTools: boolean,
  ): Promise<string> {
    const openaiTools = allowTools
      ? toolDefinitions.map((t) => ({
          type: "function" as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        }))
      : undefined;

    const chatMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...formattedMessages.map((m) => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      })),
    ];

    while (true) {
      if (!this.openai) return "";
      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: chatMessages,
        tools: openaiTools,
      });

      const choice = response.choices[0];
      if (!choice) return "";

      const message = choice.message;

      if (
        choice.finish_reason !== "tool_calls" ||
        !message.tool_calls?.length
      ) {
        return message.content?.trim() ?? "";
      }

      chatMessages.push({
        role: "assistant",
        content: message.content,
        tool_calls: message.tool_calls,
      });

      for (const toolCall of message.tool_calls) {
        if (toolCall.type !== "function") continue;
        const args = JSON.parse(toolCall.function.arguments) as Record<
          string,
          unknown
        >;
        const result = await executeTool(
          toolCall.function.name,
          args,
          this.cashFlowService,
          this.authService,
          this,
        );
        chatMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }
    }
  }

  private async getAnthropicResponse(
    systemPrompt: string,
    formattedMessages: { role: string; content: string }[],
    allowTools: boolean,
  ): Promise<string> {
    const anthropicTools = allowTools
      ? toolDefinitions.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: {
            type: "object" as const,
            properties: t.parameters.properties,
            required: t.parameters.required,
          },
        }))
      : undefined;

    const chatMessages: Anthropic.MessageParam[] = formattedMessages.map(
      (m) => ({
        role:
          m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      }),
    );

    while (true) {
      if (!this.anthropic) return "";
      const response = await this.anthropic.messages.create({
        model: this.config.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: chatMessages,
        tools: anthropicTools,
      });

      if (response.stop_reason !== "tool_use") {
        const textBlock = response.content.find((b) => b.type === "text");
        return textBlock?.type === "text" ? textBlock.text.trim() : "";
      }

      const toolUseBlocks = response.content.filter(
        (b) => b.type === "tool_use",
      );

      chatMessages.push({
        role: "assistant",
        content: response.content,
      });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of toolUseBlocks) {
        if (block.type !== "tool_use") continue;
        const args = block.input as Record<string, unknown>;
        const result = await executeTool(
          block.name,
          args,
          this.cashFlowService,
          this.authService,
          this,
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }

      chatMessages.push({
        role: "user",
        content: toolResults,
      });
    }
  }

  async generateSummary(
    messages: AiChatMessage[],
    existingSummary: string | undefined,
  ): Promise<string> {
    const systemPrompt = PromptLoader.getSummarization(
      PromptLocale.PtBr,
      existingSummary,
    );
    const formattedMessages = messages.map((m) => `[${m.role}]: ${m.text}`);
    const conversationText = formattedMessages.join("\n");

    if (this.openai) {
      const openaiResponse = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: conversationText },
        ],
      });
      return openaiResponse.choices[0]?.message?.content?.trim() ?? "";
    }

    if (this.anthropic) {
      const anthropicResponse = await this.anthropic.messages.create({
        model: this.config.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: conversationText }],
      });
      return anthropicResponse.content[0]?.type === "text"
        ? anthropicResponse.content[0].text.trim()
        : "";
    }

    return "";
  }
}
