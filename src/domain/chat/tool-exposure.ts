export const ToolTopic = {
  General: "general",
  Finance: "finance",
  Bills: "bills",
  Notes: "notes",
  Todos: "todos",
  Artifacts: "artifacts",
} as const;
export type ToolTopic = ValueOf<typeof ToolTopic>;

export const ToolRisk = {
  Read: "read",
  Write: "write",
  Destructive: "destructive",
} as const;
export type ToolRisk = ValueOf<typeof ToolRisk>;

export interface ToolExposureDTO {
  topic: ToolTopic;
  risk: ToolRisk;
  isExternalOnly?: boolean;
}
