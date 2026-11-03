import { createFileRoute } from "@tanstack/react-router";
import { toCurrentUserResponse } from "~/contracts/http/identity/identity-mapper";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";

export const Route = createFileRoute("/api/v1/web/auth/me")({
  server: {
    handlers: {
      async GET({ context }) {
        const authService = getServer().services.auth;
        const auth = context.webAuth;
        const user = await authService.getUserById(auth.userId);
        if (!user) {
          return Http.json({ error: "User not found" }, { status: 404 });
        }
        return Http.json(toCurrentUserResponse(user));
      },
    },
  },
});
