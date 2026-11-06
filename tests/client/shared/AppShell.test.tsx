import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AppShell } from "~/client/shared/components/terminal/AppShell";
import { getDictionary } from "~/client/shared/i18n/dictionary";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ invalidate: vi.fn() }),
}));

vi.mock("~/client/shared/hooks/usePrefs", () => ({
  usePrefs: () => ({ locale: "en", theme: "dark" }),
}));

const dictionary = getDictionary("en");

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
});

describe("AppShell", () => {
  test("marks the active module among the top-level tabs", () => {
    render(
      <AppShell activePath="/todo" dictionary={dictionary} title="Todos">
        <p>content</p>
      </AppShell>,
    );

    const links = screen.getAllByRole("link", { name: dictionary.nav.todo });
    expect(links[0]).toHaveAttribute("aria-current", "page");
    expect(
      screen.getAllByRole("link", { name: dictionary.nav.notes })[0],
    ).not.toHaveAttribute("aria-current");
  });

  test("opens the navigation drawer from the menu button on small screens", async () => {
    const user = userEvent.setup();
    render(
      <AppShell activePath="/todo" dictionary={dictionary} title="Todos">
        <p>content</p>
      </AppShell>,
    );

    await user.click(
      screen.getByRole("button", { name: dictionary.common.openNavigation }),
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  test("keeps privacy and log out in the more menu", async () => {
    const user = userEvent.setup();
    render(
      <AppShell
        activePath="/todo"
        dictionary={dictionary}
        showLogout
        title="Todos"
      >
        <p>content</p>
      </AppShell>,
    );

    await user.click(
      screen.getByRole("button", { name: dictionary.common.more }),
    );

    expect(
      await screen.findByRole("menuitem", { name: dictionary.nav.privacy }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: dictionary.common.logout }),
    ).toBeInTheDocument();
  });

  test("renders signed-out pages without the module navigation", () => {
    render(
      <AppShell dictionary={dictionary} showNavigation={false} title="Sign in">
        <p>content</p>
      </AppShell>,
    );

    expect(
      screen.queryByRole("link", { name: dictionary.nav.todo }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
  });
});
