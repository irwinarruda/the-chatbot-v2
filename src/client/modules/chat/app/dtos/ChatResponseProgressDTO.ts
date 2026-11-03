import type { ToolResultOutcome } from "~/domain/chat/message";

export interface ChatResponseReasoningDTO {
  contentIndex: number;
  text: string;
}

export interface ChatResponseToolDTO {
  contentIndex?: number;
  callId: string;
  name: string;
  arguments?: unknown;
  outcome?: ToolResultOutcome;
}

export interface ChatResponseRoundDTO {
  round: number;
  reasoning: ChatResponseReasoningDTO[];
  tools: ChatResponseToolDTO[];
}

export interface ChatResponseProgressDTO {
  rounds: ChatResponseRoundDTO[];
}
