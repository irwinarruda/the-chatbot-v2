import type { Model, Message as PiMessage, Usage } from "@earendil-works/pi-ai";
import { MessageContentType } from "~/modules/chat/entities/enums/MessageContentType";
import { MessageRole } from "~/modules/chat/entities/enums/MessageRole";
import { ToolResultStatus } from "~/modules/chat/entities/enums/ToolResultStatus";
import type { AiChatContextMessage } from "~/modules/chat/gateway/AiChatGateway";
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

  static map(messages: AiChatContextMessage[], model: Model<any>): PiMessage[] {
    const mapped: PiMessage[] = [];
    const toolNames = new Map<string, string>();
    for (const message of messages) {
      const content = message.content;
      if (content.type === MessageContentType.ToolCall) {
        if (message.role !== MessageRole.Assistant) {
          throw new ValidationException(
            "Tool calls must come from the assistant role",
          );
        }
        toolNames.set(content.callId, content.name);
        const last = mapped[mapped.length - 1];
        const toolCall = {
          type: "toolCall" as const,
          id: content.callId,
          name: content.name,
          arguments:
            content.arguments && typeof content.arguments === "object"
              ? (content.arguments as Record<string, unknown>)
              : { raw: String(content.arguments ?? "") },
        };
        if (last?.role === "assistant") {
          last.content.push(toolCall);
        } else {
          mapped.push({
            role: "assistant",
            content: [toolCall],
            api: model.api,
            provider: model.provider,
            model: model.id,
            usage: structuredClone(PiMessageMapper.emptyUsage),
            stopReason: "toolUse",
            timestamp: Date.now(),
          });
        }
        continue;
      }
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
          timestamp: Date.now(),
        });
        continue;
      }
      if (message.role === MessageRole.Assistant) {
        if (content.type === MessageContentType.Audio) {
          throw new ValidationException(
            "Assistant messages cannot carry audio content",
          );
        }
        const text =
          content.type === MessageContentType.Button
            ? `${content.text}\n\nSelectable options: ${(content.options ?? []).join("; ")}`.trim()
            : content.text;
        const last = mapped[mapped.length - 1];
        if (last?.role === "assistant") {
          last.content.push({ type: "text", text });
        } else {
          mapped.push({
            role: "assistant",
            content: [{ type: "text", text }],
            api: model.api,
            provider: model.provider,
            model: model.id,
            usage: structuredClone(PiMessageMapper.emptyUsage),
            stopReason: "stop",
            timestamp: Date.now(),
          });
        }
        continue;
      }
      if (message.role !== MessageRole.User) {
        throw new ValidationException("Unsupported message role in AI context");
      }
      const text =
        content.type === MessageContentType.Audio
          ? content.transcript
          : content.type === MessageContentType.Text ||
              content.type === MessageContentType.Button
            ? content.text
            : undefined;
      if (text === undefined) {
        throw new ValidationException(
          "User messages cannot carry tool content to the provider",
        );
      }
      mapped.push({ role: "user", content: text, timestamp: Date.now() });
    }
    return mapped;
  }
}
