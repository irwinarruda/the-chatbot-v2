export const ReasoningEffort = {
  Off: "off",
  Minimal: "minimal",
  Low: "low",
  Medium: "medium",
  High: "high",
  XHigh: "xhigh",
  Max: "max",
} as const;
export type ReasoningEffort = ValueOf<typeof ReasoningEffort>;

export const reasoningEfforts = Object.values(ReasoningEffort);

export function isReasoningEffort(value: unknown): value is ReasoningEffort {
  return reasoningEfforts.includes(value as ReasoningEffort);
}
