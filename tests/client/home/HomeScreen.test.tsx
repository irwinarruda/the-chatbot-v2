import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { HomeScreen } from "~/client/modules/home/screens/HomeScreen";
import { getDictionary } from "~/client/shared/i18n/dictionary";
import { useApp } from "~/client/shared/stores/app";
import type { TodoDTO } from "~/contracts/http/todos/todo";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));

vi.mock("~/client/shared/hooks/usePrefs", () => ({
  usePrefs: () => ({ locale: "en", theme: "dark", palette: "terminal" }),
}));

vi.mock("~/client/shared/components/terminal/AppShell", () => ({
  AppShell: ({
    children,
    showLogout,
  }: {
    children: ReactNode;
    showLogout?: boolean;
  }) => <div data-show-logout={String(Boolean(showLogout))}>{children}</div>,
}));

const t = getDictionary("en").welcomePage;
const initialState = useApp.getState();
const pendingTodo: TodoDTO = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Renew passport",
  description: "",
  status: "Pending",
  createdAt: "2026-07-10T12:00:00.000Z",
  updatedAt: "2026-07-10T12:00:00.000Z",
};

function stubFeatures(hasAccess: boolean) {
  useApp.setState({
    hasWebAccess: vi.fn().mockResolvedValue(hasAccess),
    bootstrapTodos: vi.fn().mockResolvedValue(undefined),
    bootstrapCashFlow: vi.fn().mockResolvedValue(undefined),
    bootstrapMonthlyExpenses: vi.fn().mockResolvedValue(undefined),
    bootstrapNotes: vi.fn().mockResolvedValue(undefined),
    isMoneyHidden: false,
    isMoneyPrivacyHydrated: true,
    todos: [pendingTodo],
  });
}

async function renderHome() {
  render(<HomeScreen />);
  await act(async () => {});
}

beforeEach(() => {
  useApp.setState(initialState, true);
});

afterEach(() => {
  useApp.setState(initialState, true);
});

describe("HomeScreen", () => {
  test("shows the areas list without a summary to signed-out visitors", async () => {
    stubFeatures(false);
    await renderHome();

    expect(screen.getByText(t.areasLabel)).toBeInTheDocument();
    expect(screen.queryByText(t.summary.title)).not.toBeInTheDocument();
  });

  test("shows the summary instead of the areas list once signed in", async () => {
    stubFeatures(true);
    await renderHome();

    expect(screen.getByText(t.summary.title)).toBeInTheDocument();
    expect(screen.getByText(t.summary.todos)).toBeInTheDocument();
    expect(screen.queryByText(t.areasLabel)).not.toBeInTheDocument();
  });

  test("marks a tile unavailable instead of showing a zero balance when its load failed", async () => {
    stubFeatures(true);
    useApp.setState({ cashFlowError: "loading" });
    await renderHome();

    expect(screen.getByText(t.summary.unavailable)).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(
      screen.queryByText(t.summary.accounts.replace("{count}", "0")),
    ).not.toBeInTheDocument();
  });

  test("drops the signed-in view when the session ends", async () => {
    stubFeatures(true);
    await renderHome();
    expect(screen.getByText(t.summary.title)).toBeInTheDocument();

    act(() => {
      useApp.setState({ isSessionExpired: true });
    });

    expect(screen.queryByText(t.summary.title)).not.toBeInTheDocument();
    expect(screen.getByText(t.areasLabel)).toBeInTheDocument();
  });
});
