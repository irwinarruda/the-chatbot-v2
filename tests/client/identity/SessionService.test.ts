import { afterEach, describe, expect, test, vi } from "vitest";
import { create } from "zustand";
import {
  createSessionService,
  type SessionService,
} from "~/client/modules/identity/app/services/SessionService";
import { apiNoteRepository } from "~/client/modules/notes/app/repositories/ApiNoteRepository";
import { ApiError } from "~/client/shared/error/ApiError";
import { useApp } from "~/client/shared/stores/app";
import type { CurrentUserDTO } from "~/contracts/http/identity/identity";
import type { NoteDTO } from "~/contracts/http/notes/note";
import { createDeferred } from "~/tests/support/create-deferred";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("sessionSlice", () => {
  test("logout clears feature state immediately and rejects an earlier user load", async () => {
    const user = createDeferred<CurrentUserDTO>();
    const logout = createDeferred<void>();
    const reset = vi.fn();
    const service = {
      getCurrentUser: () => user.promise,
      logout: () => logout.promise,
      cancelPendingRequests: vi.fn(),
    };
    const store = create<SessionService>()(
      createSessionService(reset, service),
    );
    const loading = store.getState().bootstrapSession();
    const leaving = store.getState().logout();
    expect(reset).toHaveBeenCalledOnce();
    expect(service.cancelPendingRequests).toHaveBeenCalledOnce();
    user.resolve({
      id: "old-user",
      name: "Old user",
      phoneNumber: "5511999999999",
    });
    expect(await loading).toBe("unauthorized");
    expect(store.getState().currentUser).toBeUndefined();
    expect(store.getState().isLoggingOut).toBe(true);
    logout.resolve();
    await leaving;
    expect(store.getState().isLoggingOut).toBe(false);
  });

  test("failed logout remains retryable without restoring feature data", async () => {
    const reset = vi.fn();
    const store = create<SessionService>()(
      createSessionService(reset, {
        async getCurrentUser() {
          return { id: "user", name: "User", phoneNumber: "5511999999999" };
        },
        async logout() {
          throw new ApiError("Unavailable", 503);
        },
        cancelPendingRequests() {},
      }),
    );
    await expect(store.getState().logout()).rejects.toMatchObject({
      statusCode: 503,
    });
    expect(store.getState().isLoggingOut).toBe(false);
    expect(reset).toHaveBeenCalledOnce();
  });

  test("an API 401 resets every composed feature and ignores pending note writes", async () => {
    const pending = createDeferred<NoteDTO>();
    vi.spyOn(apiNoteRepository, "createNote").mockReturnValueOnce(
      pending.promise,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 401 })),
    );
    useApp.setState({
      monthlyExpenseMonth: "2026-09",
      chatInput: "Private draft",
      currentUser: { id: "user", name: "User", phoneNumber: "5511999999999" },
    });
    const saving = useApp.getState().createNote("Private note");
    await useApp.getState().bootstrapTodos();
    pending.resolve({
      id: "note",
      name: "Private note",
      markdown: "",
      createdAt: "2026-09-13T00:00:00Z",
      updatedAt: "2026-09-13T00:00:00Z",
    });
    expect(await saving).toBeUndefined();
    expect(useApp.getState()).toMatchObject({
      isSessionExpired: true,
      currentUser: undefined,
      chatInput: "",
      chatMessages: [],
      notes: [],
      todos: [],
      monthlyExpenses: [],
      monthlyExpenseMonth: "",
      isRecording: false,
      isNoteSubmitting: false,
      cashFlowDashboard: { transactions: [], bankAccountStatuses: [] },
    });
  });
});
