import { describe, expect, test } from "vitest";
import {
  normalizeTodoSearch,
  toTodoRouteSearch,
} from "~/modules/todos/client/TodoSearch";

describe("TodoSearch", () => {
  test("defaults to pending todos", () => {
    const search = normalizeTodoSearch({});

    expect(search.status).toBe("Pending");
  });

  test("keeps completed and all status filters", () => {
    expect(normalizeTodoSearch({ status: "Completed" }).status).toBe(
      "Completed",
    );
    expect(normalizeTodoSearch({ status: "all" }).status).toBe("all");
  });

  test("falls back to pending for an unsupported status", () => {
    const search = normalizeTodoSearch({ status: "Archived" });

    expect(search.status).toBe("Pending");
  });

  test("omits the default status while preserving explicit alternatives", () => {
    expect(toTodoRouteSearch({ status: "Pending" }).status).toBeUndefined();
    expect(toTodoRouteSearch({ status: "Completed" }).status).toBe("Completed");
    expect(toTodoRouteSearch({ status: "all" }).status).toBe("all");
  });
});
