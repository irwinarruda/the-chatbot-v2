import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArrowRightLeft, Plus } from "lucide-react";
import { describe, expect, test, vi } from "vitest";
import { TerminalPageHeader } from "~/client/shared/components/terminal/TerminalPageHeader";
import { getDictionary } from "~/client/shared/i18n/dictionary";

vi.mock("~/client/shared/hooks/usePrefs", () => ({
  usePrefs: () => ({ locale: "en", theme: "dark" }),
}));

const dictionary = getDictionary("en");

describe("TerminalPageHeader", () => {
  test("names the primary action even when only its icon shows on phones", () => {
    render(
      <TerminalPageHeader
        heading="Cash Flow"
        primaryAction={{ icon: Plus, label: "New transaction" }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "New transaction" }),
    ).toBeInTheDocument();
  });

  test("offers the secondary actions by their full names in the more menu", async () => {
    const user = userEvent.setup();
    const onTransfer = vi.fn();
    render(
      <TerminalPageHeader
        heading="Cash Flow"
        primaryAction={{ icon: Plus, label: "New transaction" }}
        secondaryActions={[
          {
            icon: ArrowRightLeft,
            label: "Transfer between accounts",
            onClick: onTransfer,
            shortLabel: "Transfer",
          },
        ]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: dictionary.common.more }),
    );
    await user.click(
      await screen.findByRole("menuitem", {
        name: "Transfer between accounts",
      }),
    );

    expect(onTransfer).toHaveBeenCalledOnce();
  });

  test("shows no more menu when a page has a single action", () => {
    render(
      <TerminalPageHeader
        heading="Todos"
        primaryAction={{ icon: Plus, label: "New task" }}
      />,
    );

    expect(
      screen.queryByRole("button", { name: dictionary.common.more }),
    ).not.toBeInTheDocument();
  });
});
