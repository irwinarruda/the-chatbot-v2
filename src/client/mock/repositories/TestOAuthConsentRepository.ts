import { mockDb } from "~/client/mock/db";
import type { OAuthConsentRepository } from "~/client/modules/mcp/app/repositories/OAuthConsentRepository";

export class TestOAuthConsentRepository implements OAuthConsentRepository {
  async getPrompt() {
    return {
      clientName: "Cursor",
      redirectHost: "cursor.com",
      userEmail: mockDb.user.email ?? "demo@thechatbot.app",
    };
  }

  async decide() {
    return { redirectUrl: `${window.location.origin}/` };
  }
}
