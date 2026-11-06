import type { StateCreator } from "zustand";
import { container } from "~/client/shared/container";
import { ApiError, clientError } from "~/client/shared/error/ApiError";
import type { CurrentUserDTO } from "~/contracts/http/identity/identity";

export interface SessionService {
  currentUser?: CurrentUserDTO;
  sessionError?: ApiError | "logout";
  isLoggingOut: boolean;
  isSessionExpired: boolean;
  hasWebAccess: () => Promise<boolean>;
  bootstrapSession: () => Promise<"ok" | "unauthorized" | "not_registered">;
  expireSession: () => void;
  logout: () => Promise<void>;
}

export function createSessionService(
  resetFeatures: () => void,
): StateCreator<SessionService> {
  return (set, get) => {
    let generation = 0;
    return {
      currentUser: undefined,
      sessionError: undefined,
      isLoggingOut: false,
      isSessionExpired: false,
      hasWebAccess() {
        return container.get("SessionRepository").hasWebAccess();
      },
      async bootstrapSession() {
        const { isLoggingOut } = get();
        if (isLoggingOut) return "unauthorized";
        const request = ++generation;
        try {
          const user = await container
            .get("SessionRepository")
            .getCurrentUser();
          if (request !== generation) return "unauthorized";
          const { currentUser } = get();
          if (currentUser && currentUser.id !== user.id) resetFeatures();
          set({ currentUser: user, isSessionExpired: false });
          return "ok";
        } catch (error) {
          if (request !== generation) return "unauthorized";
          if (error instanceof ApiError) {
            if (error.statusCode === 401 || error.statusCode === 404) {
              const { expireSession } = get();
              expireSession();
              if (error.statusCode === 404) {
                set({ isSessionExpired: false });
                return "not_registered";
              }
              return "unauthorized";
            }
          }
          throw error;
        }
      },
      expireSession() {
        generation += 1;
        container.get("SessionRepository").cancelPendingRequests();
        resetFeatures();
        set({
          currentUser: undefined,
          isSessionExpired: true,
          sessionError: undefined,
        });
      },
      async logout() {
        const { isLoggingOut } = get();
        if (isLoggingOut) return;
        generation += 1;
        const sessionRepository = container.get("SessionRepository");
        sessionRepository.cancelPendingRequests();
        resetFeatures();
        set({
          currentUser: undefined,
          isLoggingOut: true,
          sessionError: undefined,
        });
        try {
          await sessionRepository.logout();
          set({ isSessionExpired: true });
        } catch (error) {
          set({ sessionError: clientError(error, "logout") });
          throw error;
        } finally {
          set({ isLoggingOut: false });
        }
      },
    };
  };
}
