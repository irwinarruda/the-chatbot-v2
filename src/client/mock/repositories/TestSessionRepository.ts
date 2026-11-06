import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { mockDb } from "~/client/mock/db";
import type { SessionRepository } from "~/client/modules/identity/app/repositories/SessionRepository";

const SignedOutPaths = ["/login", "/not-registered"];

const currentPath = createIsomorphicFn()
  .server(() => new URL(getRequest().url).pathname)
  .client(() => window.location.pathname);

export class TestSessionRepository implements SessionRepository {
  async hasWebAccess() {
    return !SignedOutPaths.includes(currentPath());
  }

  async getCurrentUser() {
    return mockDb.user;
  }

  async logout() {}

  cancelPendingRequests() {}
}
