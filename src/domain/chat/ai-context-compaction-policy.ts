import { ValidationException } from "~/domain/shared/domain-errors";
import { Chat } from "./chat";
import type { Message } from "./message";

const maximumSafetyMarginTokens = 16_384;
const safetyMarginRatio = 0.1;
const maximumTriggerTokens = 96_000;
const triggerRatio = 0.45;
const maximumTargetTokens = 64_000;
const targetRatio = 0.3;

export interface AiContextCompactionPolicy {
  hardInputTokens: number;
  triggerTokens: number;
  targetTokens: number;
  protectedRecentTurns: number;
}

export function createAiContextCompactionPolicy(
  contextWindowTokens: number,
  maxOutputTokens: number,
): AiContextCompactionPolicy {
  const safetyMarginTokens = Math.min(
    maximumSafetyMarginTokens,
    Math.floor(contextWindowTokens * safetyMarginRatio),
  );
  const hardInputTokens =
    contextWindowTokens - maxOutputTokens - safetyMarginTokens;
  if (hardInputTokens <= 0) {
    throw new ValidationException(
      "The selected model has no usable input context",
      "Choose a model with a larger context window.",
    );
  }
  return {
    hardInputTokens,
    triggerTokens: Math.min(
      maximumTriggerTokens,
      Math.floor(hardInputTokens * triggerRatio),
    ),
    targetTokens: Math.min(
      maximumTargetTokens,
      Math.floor(hardInputTokens * targetRatio),
    ),
    protectedRecentTurns: 6,
  };
}

export function selectCompactableTurns(
  turns: Message[][],
  protectedRecentTurns: number,
): Message[][] {
  const completePrefix: Message[][] = [];
  for (const turn of turns) {
    if (!Chat.isTurnComplete(turn)) break;
    completePrefix.push(turn);
  }
  const compactableCount = Math.max(
    0,
    completePrefix.length - protectedRecentTurns,
  );
  return completePrefix.slice(0, compactableCount);
}
