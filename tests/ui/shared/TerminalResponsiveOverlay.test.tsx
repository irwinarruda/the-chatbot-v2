import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { vi } from "vitest";
import { TerminalResponsiveOverlay } from "~/shared/client/components/terminal/TerminalResponsiveOverlay";

function mockDesktopOverlay(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => {
      return {
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches,
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      } as MediaQueryList;
    }),
  );
}

function ResponsiveOverlayExample() {
  const [open, setOpen] = useState(true);

  return (
    <>
      <button onClick={() => setOpen(true)} type="button">
        Open account details
      </button>
      <TerminalResponsiveOverlay
        closeLabel="Close account details"
        description="Review the current account information."
        onOpenChange={setOpen}
        open={open}
        title="Account details"
      >
        <button type="button">Save account</button>
      </TerminalResponsiveOverlay>
      <output>{open ? "Overlay open" : "Overlay closed"}</output>
    </>
  );
}

async function closeAndReopenOverlay(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("button", { name: "Close account details" }),
  );
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  expect(screen.getByText("Overlay closed")).toBeVisible();

  await user.click(
    screen.getByRole("button", { name: "Open account details" }),
  );
  expect(await screen.findByRole("dialog")).toBeVisible();
  expect(screen.getByText("Overlay open")).toBeVisible();
}

describe("TerminalResponsiveOverlay", () => {
  test("uses the desktop dialog with the controlled open contract", async () => {
    mockDesktopOverlay(true);
    const user = userEvent.setup();
    render(<ResponsiveOverlayExample />);

    const dialog = await screen.findByRole("dialog", {
      description: "Review the current account information.",
      name: "Account details",
    });
    expect(dialog).toBeVisible();
    expect(screen.getByRole("button", { name: "Save account" })).toBeVisible();

    await closeAndReopenOverlay(user);
  });

  test("uses an accessible mobile drawer surface with the same contract", async () => {
    mockDesktopOverlay(false);
    const user = userEvent.setup();
    render(<ResponsiveOverlayExample />);

    const sheet = await screen.findByRole("dialog", {
      description: "Review the current account information.",
      name: "Account details",
    });
    expect(sheet).toBeVisible();
    expect(screen.getByRole("button", { name: "Save account" })).toBeVisible();

    await closeAndReopenOverlay(user);
  });
});
