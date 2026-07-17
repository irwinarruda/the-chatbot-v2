import { render, screen } from "@testing-library/react";
import { TodoRow } from "~/modules/todos/client/components/TodoRow";
import type { TodoDTO } from "~/modules/todos/entities/dtos/TodoDTO";

const todo: TodoDTO = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Quarterly tax payment",
  description: "Review the estimate and schedule payment.",
  dueDate: "2026-07-21T12:00:00.000Z",
  status: "Pending",
  createdAt: "2026-07-10T12:00:00.000Z",
  updatedAt: "2026-07-10T12:00:00.000Z",
};

function renderTodoRow(locale: "en" | "pt-BR") {
  return render(
    <TodoRow
      completedLabel="Completed"
      locale={locale}
      noDueDateLabel="No due date"
      onOpen={() => undefined}
      onToggleStatus={() => undefined}
      pendingLabel="Pending"
      todo={todo}
    />,
  );
}

describe("TodoRow", () => {
  test("formats calendar due dates with the selected application locale", () => {
    const view = renderTodoRow("en");

    expect(screen.getByText("Jul 21, 2026")).toBeVisible();

    view.unmount();
    renderTodoRow("pt-BR");

    expect(screen.getByText("21 de jul. de 2026")).toBeVisible();
  });
});
