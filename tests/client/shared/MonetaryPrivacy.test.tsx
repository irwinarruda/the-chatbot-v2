import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { storageMonetaryPrivacyGateway } from "~/client/shared/app/gateways/StorageMonetaryPrivacyGateway";
import { MonetaryValue } from "~/client/shared/components/MonetaryValue";
import { MonetaryPrivacyControl } from "~/client/shared/components/terminal/MonetaryPrivacyControl";
import { Input } from "~/client/shared/components/ui/input";
import { TooltipProvider } from "~/client/shared/components/ui/tooltip";
import { useApp } from "~/client/shared/stores/app";

describe("Monetary privacy", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useApp.setState({
      isMoneyHidden: false,
      isMoneyPrivacyHydrated: true,
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    useApp.setState({
      isMoneyHidden: false,
      isMoneyPrivacyHydrated: true,
    });
  });

  test("masks displayed monetary values without masking active inputs", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <MonetaryPrivacyControl
          hideLabel="Hide monetary values"
          showLabel="Show monetary values"
        />
        <MonetaryValue hiddenLabel="Hidden monetary value">
          R$ 12.345,67
        </MonetaryValue>
        <Input aria-label="Amount" readOnly type="number" value="12345.67" />
      </TooltipProvider>,
    );

    expect(screen.getByText("R$ 12.345,67")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Hide monetary values" }),
    );

    expect(screen.queryByText("R$ 12.345,67")).not.toBeInTheDocument();
    expect(screen.getByText("Hidden monetary value")).toBeInTheDocument();
    expect(screen.getByText("R$ 000,00")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Amount" })).toHaveValue(
      12345.67,
    );
    expect(
      screen.getByRole("button", { name: "Show monetary values" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("restores the eye preference from local storage", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <MonetaryPrivacyControl
          hideLabel="Hide monetary values"
          showLabel="Show monetary values"
        />
      </TooltipProvider>,
    );

    await user.click(
      screen.getByRole("button", { name: "Hide monetary values" }),
    );

    expect(storageMonetaryPrivacyGateway.resolveIsMoneyHidden()).toBe(true);

    act(() => {
      useApp.setState({
        isMoneyHidden: false,
        isMoneyPrivacyHydrated: false,
      });
      useApp.getState().hydrateMoneyPrivacy();
    });

    expect(useApp.getState().isMoneyHidden).toBe(true);
  });
});
