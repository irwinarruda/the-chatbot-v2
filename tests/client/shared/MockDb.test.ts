import { describe, expect, test } from "vitest";
import { mockDb, resetMockDb } from "~/client/mock/db";
import { Scenes } from "~/client/mock/scenes";
import { ArtifactViewerResponseDTO } from "~/contracts/http/artifacts/artifact";
import { CashFlowDashboardResponseDTO } from "~/contracts/http/cash-flow/cash-flow";
import { MonthlyExpenseResponseDTO } from "~/contracts/http/cash-flow/monthly-expense";
import { ChatMessagesResponseDTO } from "~/contracts/http/chat/chat";
import { CurrentUserResponseDTO } from "~/contracts/http/identity/identity";
import { NoteResponseDTO } from "~/contracts/http/notes/note";
import { TodoResponseDTO } from "~/contracts/http/todos/todo";
import { routes } from "~/routes";

describe("demo data", () => {
  test("parses through the same contracts the API answers with", () => {
    resetMockDb();
    expect(() => {
      CurrentUserResponseDTO.parse(mockDb.user);
      ChatMessagesResponseDTO.parse(mockDb.chat);
      CashFlowDashboardResponseDTO.parse(mockDb.cashFlow);
      for (const todo of mockDb.todos) TodoResponseDTO.parse(todo);
      for (const note of mockDb.notes) NoteResponseDTO.parse(note);
      for (const bill of mockDb.monthlyExpenses) {
        MonthlyExpenseResponseDTO.parse(bill);
      }
      for (const artifact of mockDb.artifacts) {
        ArtifactViewerResponseDTO.parse({ artifact });
      }
    }).not.toThrow();
  });

  test("every scene opens a page the app routes", () => {
    const pagePaths = (routes.children ?? []).map((child) => {
      if (child.type === "index") return "/";
      return "path" in child ? child.path : undefined;
    });
    const missing = Object.entries(Scenes)
      .filter(([, scene]) => !pagePaths.includes(scene.path))
      .map(([name]) => name);
    expect(missing).toEqual([]);
  });
});
