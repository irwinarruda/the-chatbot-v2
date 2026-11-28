import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { OAuthConsentRepository } from "~/client/modules/mcp/app/repositories/OAuthConsentRepository";
import { OAuthConsentScreen } from "~/client/modules/mcp/screens/OAuthConsentScreen";
import type { Prefs } from "~/client/shared/app/entities/Prefs";
import { container } from "~/client/shared/container";
import { ApiError } from "~/client/shared/error/ApiError";
import { useApp } from "~/client/shared/stores/app";
import { DEFAULT_PREFS } from "~/contracts/http/shared/prefs-cookie";

const mockedPrefs = vi.hoisted(() => ({
  current: { locale: "pt-BR", theme: "dark", palette: "barro" } as Prefs,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ invalidate: vi.fn() }),
}));

vi.mock("~/client/shared/hooks/usePrefs", () => ({
  usePrefs: () => mockedPrefs.current,
}));

const prompt = {
  clientName: "Cursor",
  redirectHost: "cursor.com",
  userEmail: "irwin@example.com",
};

function register(overrides: Partial<OAuthConsentRepository> = {}) {
  const repository: OAuthConsentRepository = {
    getPrompt: vi.fn(async () => prompt),
    decide: vi.fn(async () => ({ redirectUrl: "https://cursor.com/cb" })),
    ...overrides,
  };
  container.register("OAuthConsentRepository", repository);
  return repository;
}

const replace = vi.fn();

beforeEach(() => {
  useApp.setState({ prefs: { ...DEFAULT_PREFS, locale: "pt-BR" } });
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
  vi.stubGlobal("location", { ...window.location, replace });
});

afterEach(() => {
  replace.mockClear();
  vi.unstubAllGlobals();
});

describe("OAuthConsentScreen", () => {
  test("names the app, the account and what the app can reach", async () => {
    register();
    render(<OAuthConsentScreen authorizationQuery="client_id=abc" />);

    expect(await screen.findByText("Cursor")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Conectar ao The Chatbot" }),
    ).toBeInTheDocument();
    expect(screen.getByText("irwin@example.com")).toBeInTheDocument();
    expect(screen.getByText("Contas do mês")).toBeInTheDocument();
    expect(
      screen.getByText("Depois de decidir, você volta para cursor.com."),
    ).toBeInTheDocument();
  });

  test("approving sends the decision and goes back to the app", async () => {
    const repository = register();
    render(<OAuthConsentScreen authorizationQuery="client_id=abc" />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Permitir acesso" }),
    );

    expect(repository.decide).toHaveBeenCalledWith("client_id=abc", "approve");
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("https://cursor.com/cb"),
    );
    expect(
      screen.getByRole("button", { name: "Voltando ao aplicativo…" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });

  test("cancelling sends a denial", async () => {
    const repository = register();
    render(<OAuthConsentScreen authorizationQuery="client_id=abc" />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Cancelar" }),
    );

    expect(repository.decide).toHaveBeenCalledWith("client_id=abc", "deny");
  });

  test("refuses a redirect that is not an http link and lets the user retry", async () => {
    register({
      decide: vi.fn(async () => ({ redirectUrl: "javascript:alert(1)" })),
    });
    render(<OAuthConsentScreen authorizationQuery="client_id=abc" />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Permitir acesso" }),
    );

    expect(
      await screen.findByText(
        "Não foi possível salvar sua escolha. Tente de novo.",
      ),
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Permitir acesso" }),
    ).toBeEnabled();
  });

  test("shows a hostile app name as plain text", async () => {
    const hostile = '<img src=x onerror="alert(1)">';
    register({
      getPrompt: vi.fn(async () => ({ ...prompt, clientName: hostile })),
    });
    const { container: view } = render(
      <OAuthConsentScreen authorizationQuery="client_id=abc" />,
    );

    expect(await screen.findByText(hostile)).toBeInTheDocument();
    expect(view.querySelector("img[onerror]")).toBeNull();
  });

  test("falls back to a generic name when the app registered none", async () => {
    register({
      getPrompt: vi.fn(async () => ({ ...prompt, clientName: undefined })),
    });
    render(<OAuthConsentScreen authorizationQuery="client_id=abc" />);

    expect(await screen.findByText("Um aplicativo")).toBeInTheDocument();
  });

  test("explains that the request could not be loaded when it is invalid", async () => {
    register({
      getPrompt: vi.fn(async () => {
        throw new ApiError("O pedido de conexão é inválido.", 400);
      }),
    });
    render(<OAuthConsentScreen authorizationQuery="" />);

    expect(
      await screen.findByRole("heading", { name: "Não foi possível conectar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Não foi possível carregar este pedido de conexão. Remova o conector e adicione de novo.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Permitir acesso" }),
    ).not.toBeInTheDocument();
  });

  test("keeps the choice available when saving it fails", async () => {
    register({
      decide: vi.fn(async () => {
        throw new Error("offline");
      }),
    });
    render(<OAuthConsentScreen authorizationQuery="client_id=abc" />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Permitir acesso" }),
    );

    expect(
      await screen.findByText(
        "Não foi possível salvar sua escolha. Tente de novo.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Permitir acesso" }),
    ).toBeEnabled();
  });
});
