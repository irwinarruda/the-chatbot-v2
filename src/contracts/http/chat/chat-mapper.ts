import type { AiModelConfigurationDTO } from "~/domain/chat/ai-chat";
import type { AiGeneration } from "~/domain/chat/ai-generation";
import type { Chat } from "~/domain/chat/chat";
import type { Message } from "~/domain/chat/message";
import { MessageAudience } from "~/domain/chat/message-audience";
import { MessageContentType } from "~/domain/chat/message-content-type";
import { MessageRole } from "~/domain/chat/message-role";
import { ReasoningEffort } from "~/domain/chat/reasoning-effort";
import {
  type AiGenerationTraceDTO,
  ChannelMessageResponseDTO,
  ChatMessagesResponseDTO,
} from "./chat";

export function toChannelMessageResponse(
  message: Message,
  trace?: AiGenerationTraceDTO[],
): ChannelMessageResponseDTO {
  return ChannelMessageResponseDTO.parse({
    ...message.toJSON(),
    clientMessageId: message.channelMessageId,
    trace,
  });
}

export function toChatMessagesResponse(
  chat: Chat | undefined,
  modelConfiguration: AiModelConfigurationDTO,
): ChatMessagesResponseDTO {
  if (!chat) {
    return ChatMessagesResponseDTO.parse({
      messages: [],
      currentModel: modelConfiguration.currentModel,
      availableModels: modelConfiguration.availableModels,
      reasoningEffort: ReasoningEffort.Off,
      supportedReasoningEfforts: modelConfiguration.supportedReasoningEfforts,
    });
  }
  const channelMessages = chat.getChannelMessages();
  const traceAnchorByTurn = new Map<string, string>();
  const messagesByGenerationId = new Map<string, Message[]>();
  for (const message of chat.messages) {
    if (message.generationId === undefined) continue;
    const messages = messagesByGenerationId.get(message.generationId) ?? [];
    messages.push(message);
    messagesByGenerationId.set(message.generationId, messages);
  }
  const generationsByTurnId = new Map<string, AiGeneration[]>();
  for (const generation of chat.generations) {
    const generations = generationsByTurnId.get(generation.turnId) ?? [];
    generations.push(generation);
    generationsByTurnId.set(generation.turnId, generations);
  }
  for (const message of channelMessages) {
    if (
      message.role === MessageRole.Assistant &&
      generationsByTurnId.has(message.turnId)
    ) {
      traceAnchorByTurn.set(message.turnId, message.id);
    }
  }
  return ChatMessagesResponseDTO.parse({
    messages: channelMessages.map((message) => {
      let trace: AiGenerationTraceDTO[] | undefined;
      if (traceAnchorByTurn.get(message.turnId) === message.id) {
        trace = createTurnTrace(
          generationsByTurnId.get(message.turnId) ?? [],
          messagesByGenerationId,
        );
        if (trace.length === 0) trace = undefined;
      }
      return toChannelMessageResponse(message, trace);
    }),
    currentModel: modelConfiguration.currentModel,
    availableModels: modelConfiguration.availableModels,
    reasoningEffort: chat.reasoningEffort,
    supportedReasoningEfforts: modelConfiguration.supportedReasoningEfforts,
  });
}

function createTurnTrace(
  generations: AiGeneration[],
  messagesByGenerationId: Map<string, Message[]>,
): AiGenerationTraceDTO[] {
  const trace: AiGenerationTraceDTO[] = [];
  for (const generation of generations) {
    const items: AiGenerationTraceDTO["items"] = [];
    for (const message of messagesByGenerationId.get(generation.id) ?? []) {
      const content = message.content;
      if (content.type === MessageContentType.Reasoning) {
        items.push({
          type: "reasoning",
          text: content.text,
          redacted: content.redacted,
        });
      } else if (content.type === MessageContentType.ToolCall) {
        items.push({
          type: "toolCall",
          callId: content.callId,
          name: content.name,
          arguments: content.arguments,
        });
      } else if (content.type === MessageContentType.ToolResult) {
        items.push({
          type: "toolResult",
          callId: content.callId,
          outcome: content.outcome,
        });
      } else if (
        content.type === MessageContentType.Text &&
        message.audience === MessageAudience.Model
      ) {
        items.push({ type: "text", text: content.text });
      }
    }
    if (
      items.length === 0 &&
      !generation.provider &&
      !generation.model &&
      !generation.usage
    ) {
      continue;
    }
    trace.push({
      id: generation.id,
      provider: generation.provider,
      model: generation.model,
      api: generation.api,
      reasoningEffort: generation.reasoningEffort,
      finishReason: generation.finishReason,
      usage: generation.usage,
      items,
    });
  }
  return trace;
}
