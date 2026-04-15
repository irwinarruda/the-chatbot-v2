import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import type { AuthService } from "~/services/AuthService";
import { Http } from "~/utils/Http";
import { WebAuth } from "~/utils/WebAuth";

export const Route = createFileRoute("/api/v1/web/auth/me")({
  server: {
    handlers: {
      async GET({ request }) {
        const authService =
          ServerBootstrap.getService<AuthService>("AuthService");
        const auth = await WebAuth.requireAuth(request);
        const user = await authService.getUserByEmail(auth.email);
        if (!user) {
          return Http.json({ error: "User not found" }, { status: 404 });
        }
        return Http.json({
          id: user.id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
        });
      },
    },
  },
});
