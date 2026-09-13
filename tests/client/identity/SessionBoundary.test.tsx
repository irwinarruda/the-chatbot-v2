import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SessionBoundary } from "~/modules/identity/client/components/SessionBoundary";
import { useApp } from "~/shared/client/stores";

const router = vi.hoisted(() => ({
  location: { pathname: "/notes/first", href: "/notes/first?q=work" },
  navigate: vi.fn(() => null),
}));

vi.mock("@tanstack/react-router", () => ({
  useRouterState: () => router.location,
  Navigate: router.navigate,
}));

beforeEach(() => {
  router.navigate.mockClear();
  router.location = { pathname: "/notes/first", href: "/notes/first?q=work" };
  useApp.setState({ isLoggingOut: false, isSessionExpired: false });
});

afterEach(() => {
  useApp.setState({ isLoggingOut: false, isSessionExpired: false });
});

describe("SessionBoundary", () => {
  test("expires the document so a restored cookie can recover without the old session flag", () => {
    useApp.setState({ isSessionExpired: true });
    render(<SessionBoundary>Private note</SessionBoundary>);
    expect(screen.queryByText("Private note")).not.toBeInTheDocument();
    expect(router.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/login",
        search: { redirect: "/notes/first?q=work" },
        replace: true,
        reloadDocument: true,
        ignoreBlocker: true,
      }),
      undefined,
    );
  });

  test.each(["/a/public-artifact", "/login", "/register"])(
    "keeps %s available after session expiry",
    (pathname) => {
      router.location = { pathname, href: pathname };
      useApp.setState({ isSessionExpired: true });
      render(<SessionBoundary>Public content</SessionBoundary>);
      expect(screen.getByText("Public content")).toBeInTheDocument();
      expect(router.navigate).not.toHaveBeenCalled();
    },
  );

  test("hides private content until logout has cleared the server cookie", () => {
    useApp.setState({ isLoggingOut: true });
    const { rerender } = render(
      <SessionBoundary>Private note</SessionBoundary>,
    );
    expect(screen.queryByText("Private note")).not.toBeInTheDocument();
    expect(router.navigate).not.toHaveBeenCalled();
    useApp.setState({ isLoggingOut: false, isSessionExpired: true });
    rerender(<SessionBoundary>Private note</SessionBoundary>);
    expect(router.navigate).toHaveBeenCalled();
  });
});
