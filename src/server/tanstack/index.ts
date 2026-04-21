import { index, rootRoute, route } from "@tanstack/virtual-file-routes";

export const routes = rootRoute("client/routes/__root.tsx", [
  index("client/routes/index.tsx"),
  route("/privacy", "client/routes/privacy.tsx"),
  route("/chat", [
    index("client/routes/chat/index.tsx"),
    route("/login", "client/routes/chat/login.tsx"),
    route("/not-registered", "client/routes/chat/not-registered.tsx"),
  ]),
  route("/google", [
    route("/already-signed-in", "client/routes/google/already-signed-in.tsx"),
    route("/thank-you", "client/routes/google/thank-you.tsx"),
  ]),
  route("/api/v1/status", "server/tanstack/controllers/status.ts"),
  route("/api/v1/migration", "server/tanstack/controllers/migration.ts"),
  route(
    "/api/v1/whatsapp/webhook",
    "server/tanstack/controllers/whatsapp-webhook.ts",
  ),
  route("/api/v1/google/login", "server/tanstack/controllers/google-login.ts"),
  route(
    "/api/v1/google/redirect",
    "server/tanstack/controllers/google-redirect.ts",
  ),
  route(
    "/api/v1/web/auth/login",
    "server/tanstack/controllers/web-auth-login.ts",
  ),
  route(
    "/api/v1/web/auth/logout",
    "server/tanstack/controllers/web-auth-logout.ts",
  ),
  route("/api/v1/web/auth/me", "server/tanstack/controllers/web-auth-me.ts"),
  route(
    "/api/v1/web/auth/redirect",
    "server/tanstack/controllers/web-auth-redirect.ts",
  ),
  route("/api/v1/web/messages", "server/tanstack/controllers/web-messages.ts"),
  route("/api/v1/web/audio", "server/tanstack/controllers/web-audio.ts"),
  route("/api/v1/web/stream", "server/tanstack/controllers/web-stream.ts"),
]);

export default routes;
