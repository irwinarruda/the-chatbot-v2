import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TodoDetailDialog } from "~/modules/todos/client/components/TodoDetailDialog";
import { TodoDetailScreen } from "~/modules/todos/client/screens/TodoDetailScreen";

const { appState, navigate } = vi.hoisted(() => ({
  navigate: vi.fn(),
  appState: {
    selectedTodo: { id: "first", name: "First todo" },
    isTodoSubmitting: false,
    loadTodo: vi.fn(),
    updateTodo: vi.fn(),
    deleteTodo: vi.fn(async () => false),
  },
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("~/shared/client/providers/usePrefs", () => ({
  usePrefs: () => ({ locale: "en", theme: "dark" }),
}));
vi.mock("~/shared/client/stores", () => ({
  useApp: (selector: (state: typeof appState) => unknown) => selector(appState),
}));
vi.mock("~/modules/todos/client/components/TodoDetailDialog", () => ({
  TodoDetailDialog: ({
    todo,
    onSave,
    onDelete,
  }: ComponentProps<typeof TodoDetailDialog>) => (
    <div>
      <span>{todo?.name ?? "Loading todo"}</span>
      <button
        onClick={() =>
          onSave({
            name: "Changed",
            description: "",
            dueDate: null,
            status: "Pending",
          })
        }
        type="button"
      >
        Save
      </button>
      <button onClick={onDelete} type="button">
        Delete
      </button>
    </div>
  ),
}));

describe("TodoDetailScreen", () => {
  beforeEach(() => vi.clearAllMocks());

  test("does not display or modify a cached todo from a different URL", () => {
    render(<TodoDetailScreen todoId="second" search={{}} />);
    expect(screen.getByText("Loading todo")).toBeInTheDocument();
    expect(screen.queryByText("First todo")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(appState.updateTodo).not.toHaveBeenCalled();
    expect(appState.deleteTodo).not.toHaveBeenCalled();
    expect(appState.loadTodo).toHaveBeenCalledWith("second");
  });

  test("keeps the detail open when deletion fails", async () => {
    render(<TodoDetailScreen todoId="first" search={{}} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(appState.deleteTodo).toHaveBeenCalledWith("first"),
    );
    expect(navigate).not.toHaveBeenCalled();
  });
});
