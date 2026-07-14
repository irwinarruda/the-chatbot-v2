export const TodoStatus = {
  Pending: "Pending",
  Completed: "Completed",
} as const;
export type TodoStatus = ValueOf<typeof TodoStatus>;
