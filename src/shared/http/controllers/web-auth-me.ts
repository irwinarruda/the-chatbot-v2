import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { toCurrentUserResponse } from "~/modules/identity/server/IdentityContractMapper";
import { Http } from "~/shared/http/utils/Http";

export const Route = createFileRoute("/api/v1/web/auth/me")({
  server: {
    handlers: {
      async GET({ context }) {
        const authService = ServerBootstrap.getApplication().services.auth;
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
