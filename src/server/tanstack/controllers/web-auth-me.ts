import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import type { AuthService } from "~/server/services/AuthService";
import { Http } from "~/server/utils/Http";
import type { SharedCurrentUser } from "~/shared/types/web-chat";

export const Route = createFileRoute("/api/v1/web/auth/me")({
  server: {
    handlers: {
      async GET({ context }) {
        const authService =
          ServerBootstrap.getService<AuthService>("AuthService");
        const auth = context.webAuth;
        const user = await authService.getUserById(auth.userId);
        if (!user) {
          return Http.json({ error: "User not found" }, { status: 404 });
        }
        const currentUser: SharedCurrentUser = user.toJSON();
        return Http.json(currentUser);
      },
    },
  },
});
