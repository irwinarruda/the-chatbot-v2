import { mockDb } from "~/client/mock/db";
import type { SessionRepository } from "~/client/modules/identity/app/repositories/SessionRepository";

export class TestSessionRepository implements SessionRepository {
  async getCurrentUser() {
    return mockDb.user;
  }

  async logout() {}

  cancelPendingRequests() {}
}
