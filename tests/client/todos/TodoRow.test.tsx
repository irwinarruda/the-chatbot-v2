import { render, screen } from "@testing-library/react";
import { TodoRow } from "~/client/modules/todos/screens/TodoScreen/TodoRow";
import { getDictionary } from "~/client/shared/i18n/dictionary";
import type { TodoDTO } from "~/contracts/http/todos/todo";

const todo: TodoDTO = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Quarterly tax payment",
  description: "Review the estimate and schedule payment.",
  dueDate: "2026-07-21T12:00:00.000Z",
  status: "Pending",
  createdAt: "2026-07-10T12:00:00.000Z",
  updatedAt: "2026-07-10T12:00:00.000Z",
};

function renderTodoRow(locale: "en" | "pt-BR", value: TodoDTO = todo) {
  return render(
    <TodoRow
      locale={locale}
      onOpen={() => undefined}
      onToggleStatus={() => undefined}
      t={getDictionary(locale).todoPage}
      todo={value}
    />,
  );
}

describe("TodoRow", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("formats upcoming due dates with the selected application locale", () => {
    vi.useFakeTimers({ now: new Date(2026, 6, 1, 9) });
    const view = renderTodoRow("en");

    expect(screen.getByText("Due Jul 21")).toBeVisible();

    view.unmount();
    renderTodoRow("pt-BR");

    expect(screen.getByText("Vence 21 de jul.")).toBeVisible();
  });

  test("flags a pending task due today and one past its due date", () => {
    vi.useFakeTimers({ now: new Date(2026, 6, 21, 9) });
    const view = renderTodoRow("en");

    expect(screen.getByText("Due today")).toBeVisible();

    view.unmount();
    vi.setSystemTime(new Date(2026, 6, 25, 9));
    renderTodoRow("en");

    expect(screen.getByText("Overdue · Jul 21")).toBeVisible();
  });

  test("does not flag a completed task as overdue", () => {
    vi.useFakeTimers({ now: new Date(2026, 6, 25, 9) });
    renderTodoRow("en", { ...todo, status: "Completed" });

    expect(screen.getByText("Due Jul 21")).toBeVisible();
  });
});
