import { loadConfig } from "@infra/config";
import { getService } from "@infra/server-bootstrap";
import { requireWebAuth } from "@infra/web";
import { createFileRoute } from "@tanstack/react-router";
import type { AuthService } from "~/services/AuthService";
import { Http } from "~/utils/Http";

export const Route = createFileRoute("/api/v1/web/auth/me")({
  server: {
    handlers: {
      async GET({ request }) {
        const config = loadConfig();
        const authService = getService<AuthService>("AuthService");
        const auth = await requireWebAuth(request, config);
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
