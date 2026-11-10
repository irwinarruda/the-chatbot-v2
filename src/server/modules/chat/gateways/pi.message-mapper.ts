import type {
  Api,
  AssistantMessage,
  JsonObject,
  Model,
  Message as PiMessage,
  StopReason,
  TextContent,
  Usage,
} from "@earendil-works/pi-ai";
import { z } from "zod";
import { replyWithOptionsToolName } from "~/contracts/tools/chat/reply-with-options";
import type {
  AiChatContextMessageDTO,
  AiGenerationContextDTO,
} from "~/domain/chat/ai-chat";
import { MessageContentType } from "~/domain/chat/message-content-type";
import { MessageRole } from "~/domain/chat/message-role";
import { ToolResultStatus } from "~/domain/chat/tool-result-status";
import { ValidationException } from "~/domain/shared/domain-errors";

export class PiMessageMapper {
  private static emptyUsage: Usage = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
    },
  };

  static map(
    messages: AiChatContextMessageDTO[],
    model: Model<Api>,
  ): PiMessage[] {
    const mapped: PiMessage[] = [];
    const toolNames = new Map<string, string>();
    let currentGenerationId: string | undefined;
    let optionsReplyCount = 0;
    for (const message of messages) {
      const content = message.content;
      if (content.type === MessageContentType.ToolResult) {
        const toolName = toolNames.get(content.callId);
        if (!toolName) {
          throw new ValidationException(
            "Tool results must follow their tool call in the model context",
          );
        }
        const outcomeText = JSON.stringify(content.outcome);
        mapped.push({
          role: "toolResult",
          toolCallId: content.callId,
          toolName,
          content: [{ type: "text", text: outcomeText }],
          details: z.json().parse(JSON.parse(outcomeText)),
          isError: content.outcome.status !== ToolResultStatus.Succeeded,
          timestamp: message.timestamp,
        });
        currentGenerationId = undefined;
        continue;
      }
      if (message.role === MessageRole.Assistant) {
        if (
          content.type === MessageContentType.Audio ||
          content.type === MessageContentType.Command
        ) {
          throw new ValidationException(
            "Assistant model messages cannot carry audio or command content",
          );
        }
        const generationId = message.generation?.id;
        let options: string[] = [];
        if (content.type === MessageContentType.Button) {
          options = content.options ?? [];
        }
        let assistant = mapped[mapped.length - 1];
        if (
          assistant?.role !== "assistant" ||
          currentGenerationId !== generationId
        ) {
          assistant = PiMessageMapper.createAssistantMessage(
            message.generation,
            model,
            message.timestamp,
            content.type === MessageContentType.ToolCall || options.length > 0,
          );
          mapped.push(assistant);
        }
        currentGenerationId = generationId;
        if (content.type === MessageContentType.Reasoning) {
          assistant.content.push({
            type: "thinking",
            thinking: content.text,
            thinkingSignature: content.thinkingSignature,
            redacted: content.redacted,
          });
          continue;
        }
        if (content.type === MessageContentType.ToolCall) {
          toolNames.set(content.callId, content.name);
          let toolArguments: JsonObject;
          if (content.arguments && typeof content.arguments === "object") {
            toolArguments = z
              .record(z.string(), z.json())
              .parse(JSON.parse(JSON.stringify(content.arguments)));
          } else {
            toolArguments = { raw: String(content.arguments ?? "") };
          }
          assistant.content.push({
            type: "toolCall",
            id: content.callId,
            name: content.name,
            arguments: toolArguments,
            thoughtSignature: content.thoughtSignature,
          });
          continue;
        }
        if (options.length > 0) {
          optionsReplyCount += 1;
          const callId = `reply_${optionsReplyCount}`;
          const outcome = {
            status: ToolResultStatus.Succeeded,
            data: { message: "Options sent" },
          };
          assistant.content.push({
            type: "toolCall",
            id: callId,
            name: replyWithOptionsToolName,
            arguments: { message: content.text, options },
          });
          mapped.push({
            role: "toolResult",
            toolCallId: callId,
            toolName: replyWithOptionsToolName,
            content: [{ type: "text", text: JSON.stringify(outcome) }],
            details: outcome,
            isError: false,
            timestamp: message.timestamp,
          });
          currentGenerationId = undefined;
          continue;
        }
        const textContent: TextContent = {
          type: "text",
          text: content.text,
        };
        if (content.type === MessageContentType.Text) {
          textContent.textSignature = content.textSignature;
        }
        assistant.content.push(textContent);
        continue;
      }
      currentGenerationId = undefined;
      if (message.role !== MessageRole.User) {
        throw new ValidationException("Unsupported message role in AI context");
      }
      let text: string | undefined;
      if (content.type === MessageContentType.Audio) {
        text = content.transcript;
      } else if (
        content.type === MessageContentType.Text ||
        content.type === MessageContentType.Button
      ) {
        text = content.text;
      }
      if (text === undefined) {
        throw new ValidationException(
          "User messages cannot carry model-only content to the provider",
        );
      }
      mapped.push({
        role: "user",
        content: text,
        timestamp: message.timestamp,
      });
    }
    return mapped;
  }

  private static createAssistantMessage(
    generation: AiGenerationContextDTO | undefined,
    model: Model<Api>,
    timestamp: number,
    hasToolCall: boolean,
  ): AssistantMessage {
    let stopReason: StopReason = "stop";
    if (hasToolCall) stopReason = "toolUse";
    if (generation && PiMessageMapper.isStopReason(generation.finishReason)) {
      stopReason = generation.finishReason;
    }
    return {
      role: "assistant",
      content: [],
      api: (generation?.api ?? model.api) as AssistantMessage["api"],
      provider: (generation?.provider ??
        model.provider) as AssistantMessage["provider"],
      model: generation?.model ?? model.id,
      responseModel: generation?.responseModel,
      responseId: generation?.responseId,
      diagnostics: generation?.diagnostics as AssistantMessage["diagnostics"],
      usage: generation?.usage ?? structuredClone(PiMessageMapper.emptyUsage),
      stopReason,
      timestamp: generation?.timestamp ?? timestamp,
    };
  }

  private static isStopReason(value: string): value is StopReason {
    return ["stop", "length", "toolUse", "error", "aborted"].includes(value);
  }
}
