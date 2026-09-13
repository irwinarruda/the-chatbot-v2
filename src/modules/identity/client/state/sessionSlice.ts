import type { StateCreator } from "zustand";
import { sessionService } from "~/modules/identity/client/services/sessionService";
import type { CurrentUserDTO } from "~/modules/identity/entities/dtos/IdentityDTO";
import { ApiError, clientError } from "~/shared/client/services/ApiClient";

export interface SessionSlice {
  currentUser?: CurrentUserDTO;
  sessionError?: ApiError | "logout";
  isLoggingOut: boolean;
  isSessionExpired: boolean;
  bootstrapSession: () => Promise<"ok" | "unauthorized" | "not_registered">;
  expireSession: () => void;
  logout: () => Promise<void>;
}

export function createSessionSlice(
  resetFeatures: () => void,
  service: typeof sessionService = sessionService,
): StateCreator<SessionSlice> {
  return (set, get) => {
    let generation = 0;
    return {
      currentUser: undefined,
      sessionError: undefined,
      isLoggingOut: false,
      isSessionExpired: false,
      async bootstrapSession() {
        const { isLoggingOut } = get();
        if (isLoggingOut) return "unauthorized";
        const request = ++generation;
        try {
          const user = await service.getCurrentUser();
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
        service.cancelPendingRequests();
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
        service.cancelPendingRequests();
        resetFeatures();
        set({
          currentUser: undefined,
          isLoggingOut: true,
          sessionError: undefined,
        });
        try {
          await service.logout();
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
