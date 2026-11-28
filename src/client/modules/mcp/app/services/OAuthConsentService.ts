import type { StateCreator } from "zustand";
import { container } from "~/client/shared/container";
import { type ApiError, clientError } from "~/client/shared/error/ApiError";
import type {
  OAuthConsentDecision,
  OAuthConsentPromptResponseDTO,
} from "~/contracts/http/mcp/oauth";

export type OAuthConsentErrorCode = "loading" | "deciding";

export interface OAuthConsentService {
  consentPrompt?: OAuthConsentPromptResponseDTO;
  consentRedirectUrl?: string;
  isConsentLoading: boolean;
  isConsentDeciding: boolean;
  consentError?: OAuthConsentErrorCode | ApiError;
  loadConsent: (authorizationQuery: string) => Promise<void>;
  decideConsent: (
    authorizationQuery: string,
    decision: OAuthConsentDecision,
  ) => Promise<void>;
  resetConsent: () => void;
}

function isWebUrl(value: string) {
  if (!URL.canParse(value)) return false;
  const { protocol } = new URL(value);
  return protocol === "https:" || protocol === "http:";
}

const initialConsentState = {
  consentPrompt: undefined,
  consentRedirectUrl: undefined,
  isConsentLoading: true,
  isConsentDeciding: false,
  consentError: undefined,
};

export const createOAuthConsentService: StateCreator<OAuthConsentService> = (
  set,
  get,
) => {
  let generation = 0;
  return {
    ...initialConsentState,
    async loadConsent(authorizationQuery) {
      const request = ++generation;
      set({ ...initialConsentState });
      try {
        const consentPrompt = await container
          .get("OAuthConsentRepository")
          .getPrompt(authorizationQuery);
        if (request === generation) set({ consentPrompt });
      } catch (error) {
        if (request === generation)
          set({ consentError: clientError(error, "loading") });
      } finally {
        if (request === generation) set({ isConsentLoading: false });
      }
    },
    async decideConsent(authorizationQuery, decision) {
      const { isConsentDeciding, consentRedirectUrl } = get();
      if (isConsentDeciding || consentRedirectUrl) return;
      const request = generation;
      set({ isConsentDeciding: true, consentError: undefined });
      try {
        const { redirectUrl } = await container
          .get("OAuthConsentRepository")
          .decide(authorizationQuery, decision);
        if (request !== generation) return;
        if (!isWebUrl(redirectUrl)) throw new Error("Unsafe redirect");
        set({ consentRedirectUrl: redirectUrl });
      } catch (error) {
        if (request === generation) {
          set({
            consentError: clientError(error, "deciding"),
            isConsentDeciding: false,
          });
        }
      }
    },
    resetConsent() {
      generation += 1;
      set({ ...initialConsentState });
    },
  };
};
