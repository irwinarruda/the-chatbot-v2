import type {
  ChatResponseProgressDTO,
  ChatResponseRoundDTO,
  ChatResponseToolDTO,
} from "~/modules/chat/client/entities/dtos/ChatResponseProgressDTO";
import type { ChatResponseProgressEventDTO } from "~/modules/chat/entities/dtos/ChatDTO";
import { ToolResultStatus } from "~/modules/chat/entities/enums/ToolResultStatus";

export function reduceChatResponseProgress(
  current: ChatResponseProgressDTO | undefined,
  event: ChatResponseProgressEventDTO,
): ChatResponseProgressDTO {
  return reduceChatResponseProgressEvents(current, [event]);
}

export function reduceChatResponseProgressEvents(
  current: ChatResponseProgressDTO | undefined,
  events: ChatResponseProgressEventDTO[],
): ChatResponseProgressDTO {
  const rounds =
    current?.rounds.map((round) => ({
      ...round,
      reasoning: round.reasoning.map((item) => ({ ...item })),
      tools: round.tools.map((tool) => ({ ...tool })),
    })) ?? [];
  for (const event of events) {
    let round = rounds.find((candidate) => candidate.round === event.round);
    if (!round) {
      round = { round: event.round, reasoning: [], tools: [] };
      rounds.push(round);
    }
    if (event.type === "reasoningDelta") {
      reduceReasoningDelta(round, event);
    } else if (event.type === "toolCall") {
      reduceToolCall(round, event);
    } else {
      reduceToolResult(round, event);
    }
  }
  return { rounds };
}

function reduceReasoningDelta(
  round: ChatResponseRoundDTO,
  event: Extract<ChatResponseProgressEventDTO, { type: "reasoningDelta" }>,
) {
  const reasoning = round.reasoning.find(
    (candidate) => candidate.contentIndex === event.contentIndex,
  );
  if (reasoning) {
    reasoning.text += event.delta;
    return;
  }
  round.reasoning.push({
    contentIndex: event.contentIndex,
    text: event.delta,
  });
}

function reduceToolCall(
  round: ChatResponseRoundDTO,
  event: Extract<ChatResponseProgressEventDTO, { type: "toolCall" }>,
) {
  let tool = round.tools.find((candidate) => candidate.callId === event.callId);
  if (!tool) {
    tool = createTool(event.callId, event.name);
    round.tools.push(tool);
  }
  tool.contentIndex = event.contentIndex;
  tool.name = event.name;
  tool.arguments = event.arguments;
}

function reduceToolResult(
  round: ChatResponseRoundDTO,
  event: Extract<ChatResponseProgressEventDTO, { type: "toolResult" }>,
) {
  let tool = round.tools.find((candidate) => candidate.callId === event.callId);
  if (!tool) {
    tool = createTool(event.callId, event.name);
    round.tools.push(tool);
  }
  tool.name = event.name;
  if (event.outcome.status === ToolResultStatus.Succeeded) {
    tool.outcome = {
      status: ToolResultStatus.Succeeded,
      data: event.outcome.data,
    };
    return;
  }
  tool.outcome = event.outcome;
}

function createTool(callId: string, name: string): ChatResponseToolDTO {
  return { callId, name };
}
