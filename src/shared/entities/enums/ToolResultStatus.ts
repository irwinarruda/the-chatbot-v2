export const ToolResultStatus = {
  Succeeded: "succeeded",
  Failed: "failed",
  Unknown: "unknown",
} as const;
export type ToolResultStatus = ValueOf<typeof ToolResultStatus>;
