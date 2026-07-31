import { useEffect, useState } from "react";
import {
  type ChatActivityLabels,
  ReasoningActivity,
  ToolActivity,
} from "~/modules/chat/client/components/ChatActivity";
import type {
  ChatResponseProgressDTO,
  ChatResponseReasoningDTO,
  ChatResponseToolDTO,
} from "~/modules/chat/client/entities/dtos/ChatResponseProgressDTO";

interface ChatResponseProgressProps {
  progress?: ChatResponseProgressDTO;
  respondingLabel: string;
  respondingElapsedLabel: string;
  labels: ChatActivityLabels;
}

type ProgressActivity =
  | {
      type: "reasoning";
      round: number;
      contentIndex: number;
      reasoning: ChatResponseReasoningDTO;
    }
  | {
      type: "tool";
      round: number;
      contentIndex: number;
      tool: ChatResponseToolDTO;
    };

export function ChatResponseProgress({
  progress,
  respondingLabel,
  respondingElapsedLabel,
  labels,
}: ChatResponseProgressProps) {
  const [startedAt] = useState(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const activities = getProgressActivities(progress);
  const elapsedLabel = respondingElapsedLabel.replace(
    "{seconds}",
    elapsedSeconds.toString(),
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [startedAt]);

  return (
    <article className="w-full py-2">
      <div
        role="status"
        aria-label={respondingLabel}
        className="border-term-border border-b pb-2 font-mono text-term-muted text-xs"
      >
        <span aria-hidden="true">
          {elapsedSeconds > 0 ? elapsedLabel : respondingLabel}
        </span>
      </div>
      <div
        className="mt-1.5 flex flex-col gap-1.5 [&>[data-slot=chat-tool-activity]+[data-slot=chat-tool-activity]]:-mt-1.5"
        aria-live="off"
      >
        {activities.map((activity) => {
          const key = `${activity.round}:${activity.contentIndex}:${activity.type}`;
          if (activity.type === "reasoning") {
            return (
              <ReasoningActivity
                key={key}
                text={activity.reasoning.text}
                label={labels.traceReasoning}
                redactedLabel={labels.traceRedacted}
                isLive
              />
            );
          }
          return (
            <ToolActivity
              key={`${key}:${activity.tool.callId}`}
              name={activity.tool.name}
              argumentsValue={activity.tool.arguments}
              outcome={activity.tool.outcome}
              runningLabel={labels.toolRunning}
              succeededLabel={labels.toolSucceeded}
              failedLabel={labels.toolFailed}
              unknownLabel={labels.toolUnknown}
              inputLabel={labels.toolInput}
              outputLabel={labels.toolOutput}
            />
          );
        })}
        {activities.length === 0 && (
          <span className="terminal-cursor" aria-hidden="true" />
        )}
      </div>
    </article>
  );
}

function getProgressActivities(
  progress?: ChatResponseProgressDTO,
): ProgressActivity[] {
  if (!progress) return [];
  return progress.rounds
    .flatMap((round) => [
      ...round.reasoning.map(
        (reasoning): ProgressActivity => ({
          type: "reasoning",
          round: round.round,
          contentIndex: reasoning.contentIndex,
          reasoning,
        }),
      ),
      ...round.tools.map(
        (tool): ProgressActivity => ({
          type: "tool",
          round: round.round,
          contentIndex: tool.contentIndex ?? Number.MAX_SAFE_INTEGER,
          tool,
        }),
      ),
    ])
    .sort((left, right) => {
      if (left.round !== right.round) return left.round - right.round;
      return left.contentIndex - right.contentIndex;
    });
}
