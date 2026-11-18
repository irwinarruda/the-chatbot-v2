import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CashFlowConnectScreen } from "~/client/modules/cash-flow/screens/CashFlowConnectScreen";
import { getDictionary } from "~/client/shared/i18n/dictionary";
import { useApp } from "~/client/shared/stores/app";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("~/client/shared/hooks/usePrefs", () => ({
  usePrefs: () => ({ locale: "en", theme: "dark", palette: "barro" }),
}));

vi.mock("~/client/shared/components/terminal/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const t = getDictionary("en").cashFlowPage;
const initialState = useApp.getState();

beforeEach(() => {
  navigate.mockReset();
  useApp.setState(initialState, true);
});

afterEach(() => {
  useApp.setState(initialState, true);
});

describe("CashFlowConnectScreen", () => {
  test("connects the spreadsheet the link names and returns to cash flow", async () => {
    const user = userEvent.setup();
    const connect = vi.fn().mockResolvedValue(true);
    useApp.setState({ connectCashFlowSpreadsheet: connect });
    render(<CashFlowConnectScreen search={{ spreadsheet: "sheet-id" }} />);

    await user.click(
      screen.getByRole("button", { name: t.connectChooseAction }),
    );

    expect(connect).toHaveBeenCalledWith("sheet-id");
    expect(navigate).toHaveBeenCalledWith({ to: "/cash-flow" });
  });

  test("stays on the page and says why when the spreadsheet was not connected", async () => {
    const user = userEvent.setup();
    const connect = vi.fn(async () => {
      useApp.setState({ cashFlowError: "connecting" });
      return false;
    });
    useApp.setState({ connectCashFlowSpreadsheet: connect });
    render(<CashFlowConnectScreen search={{}} />);

    await user.click(
      screen.getByRole("button", { name: t.connectChooseAction }),
    );

    expect(connect).toHaveBeenCalledWith(undefined);
    expect(await screen.findByText(t.errorConnecting)).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });
});
