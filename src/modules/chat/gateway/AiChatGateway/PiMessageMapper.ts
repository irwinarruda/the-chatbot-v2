import type {
  AssistantMessage,
  Model,
  Message as PiMessage,
  StopReason,
  Usage,
} from "@earendil-works/pi-ai";
import type {
  AiChatContextMessageDTO,
  AiGenerationContextDTO,
} from "~/modules/chat/entities/dtos/AiChatGatewayDTO";
import { MessageContentType } from "~/modules/chat/entities/enums/MessageContentType";
import { MessageRole } from "~/modules/chat/entities/enums/MessageRole";
import { ToolResultStatus } from "~/modules/chat/entities/enums/ToolResultStatus";
import { ValidationException } from "~/shared/errors/DomainErrors";

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
    model: Model<any>,
  ): PiMessage[] {
    const mapped: PiMessage[] = [];
    const toolNames = new Map<string, string>();
    let currentGenerationId: string | undefined;
    for (const message of messages) {
      const content = message.content;
      if (content.type === MessageContentType.ToolResult) {
        const toolName = toolNames.get(content.callId);
        if (!toolName) {
          throw new ValidationException(
            "Tool results must follow their tool call in the model context",
          );
        }
        mapped.push({
          role: "toolResult",
          toolCallId: content.callId,
          toolName,
          content: [{ type: "text", text: JSON.stringify(content.outcome) }],
          details: content.outcome,
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
        let assistant = mapped[mapped.length - 1];
        if (
          assistant?.role !== "assistant" ||
          currentGenerationId !== generationId
        ) {
          assistant = PiMessageMapper.createAssistantMessage(
            message.generation,
            model,
            message.timestamp,
            content.type === MessageContentType.ToolCall,
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
          let toolArguments: Record<string, unknown>;
          if (content.arguments && typeof content.arguments === "object") {
            toolArguments = content.arguments as Record<string, unknown>;
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
        let text = content.text;
        if (content.type === MessageContentType.Button) {
          text =
            `${content.text}\n\nSelectable options: ${(content.options ?? []).join("; ")}`.trim();
        }
        const textContent: Extract<
          AssistantMessage["content"][number],
          { type: "text" }
        > = {
          type: "text",
          text,
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
    model: Model<any>,
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
