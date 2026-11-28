import { describe, expect, test, vi } from "vitest";
import { create } from "zustand";
import type { OAuthConsentRepository } from "~/client/modules/mcp/app/repositories/OAuthConsentRepository";
import {
  createOAuthConsentService,
  type OAuthConsentService,
} from "~/client/modules/mcp/app/services/OAuthConsentService";
import { container } from "~/client/shared/container";
import { ApiError } from "~/client/shared/error/ApiError";

const prompt = {
  clientName: "Cursor",
  redirectHost: "cursor.com",
  userEmail: "irwin@example.com",
};

function createStore(overrides: Partial<OAuthConsentRepository> = {}) {
  const repository: OAuthConsentRepository = {
    getPrompt: vi.fn(async () => prompt),
    decide: vi.fn(async () => ({ redirectUrl: "https://cursor.com/cb" })),
    ...overrides,
  };
  container.register("OAuthConsentRepository", repository);
  return {
    repository,
    store: create<OAuthConsentService>()(createOAuthConsentService),
  };
}

describe("OAuthConsentService", () => {
  test("starts loading and shows the prompt once the server answers", async () => {
    const { store } = createStore();
    expect(store.getState().isConsentLoading).toBe(true);
    await store.getState().loadConsent("client_id=abc");
    expect(store.getState()).toMatchObject({
      consentPrompt: prompt,
      isConsentLoading: false,
      consentError: undefined,
    });
  });

  test("keeps the server's message when the request is rejected", async () => {
    const { store } = createStore({
      getPrompt: vi.fn(async () => {
        throw new ApiError("O pedido de conexão é inválido.", 400);
      }),
    });
    await store.getState().loadConsent("client_id=abc");
    expect(store.getState().consentPrompt).toBeUndefined();
    expect(store.getState().isConsentLoading).toBe(false);
    expect(store.getState().consentError).toBeInstanceOf(ApiError);
  });

  test("keeps the buttons locked and sends one decision while it redirects", async () => {
    const { store, repository } = createStore();
    await store.getState().loadConsent("client_id=abc");
    await store.getState().decideConsent("client_id=abc", "approve");
    await store.getState().decideConsent("client_id=abc", "deny");
    expect(repository.decide).toHaveBeenCalledTimes(1);
    expect(repository.decide).toHaveBeenCalledWith("client_id=abc", "approve");
    expect(store.getState()).toMatchObject({
      consentRedirectUrl: "https://cursor.com/cb",
      isConsentDeciding: true,
    });
  });

  test("unlocks the buttons when saving the decision fails", async () => {
    const { store } = createStore({
      decide: vi.fn(async () => {
        throw new Error("offline");
      }),
    });
    await store.getState().loadConsent("client_id=abc");
    await store.getState().decideConsent("client_id=abc", "approve");
    expect(store.getState()).toMatchObject({
      consentError: "deciding",
      isConsentDeciding: false,
      consentRedirectUrl: undefined,
    });
  });

  test("ignores an answer that arrives after the page was left", async () => {
    let resolve: (value: typeof prompt) => void = () => {};
    const { store } = createStore({
      getPrompt: vi.fn(
        () => new Promise<typeof prompt>((done) => (resolve = done)),
      ),
    });
    const loading = store.getState().loadConsent("client_id=abc");
    store.getState().resetConsent();
    resolve(prompt);
    await loading;
    expect(store.getState().consentPrompt).toBeUndefined();
    expect(store.getState().isConsentLoading).toBe(true);
  });
});
