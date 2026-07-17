import { index, rootRoute, route } from "@tanstack/virtual-file-routes";

export const routes = rootRoute("shared/client/routes/__root.tsx", [
  index("shared/client/routes/index.tsx"),
  route("/privacy", "shared/client/routes/privacy.tsx"),
  route("/chat", [
    index("shared/client/routes/chat/index.tsx"),
    route("/login", "shared/client/routes/chat/login.tsx"),
    route("/not-registered", "shared/client/routes/chat/not-registered.tsx"),
  ]),
  route("/todo", "shared/client/routes/todo.tsx", [
    index("shared/client/routes/todo/index.tsx"),
    route("/$todoId", "shared/client/routes/todo/$todoId.tsx"),
  ]),
  route("/bills", "shared/client/routes/bills.tsx"),
  route("/google", [
    route(
      "/already-signed-in",
      "shared/client/routes/google/already-signed-in.tsx",
    ),
    route("/thank-you", "shared/client/routes/google/thank-you.tsx"),
  ]),
  route("/api/v1/status", "shared/http/controllers/status.ts"),
  route("/api/v1/migration", "shared/http/controllers/migration.ts"),
  route(
    "/api/v1/whatsapp/webhook",
    "shared/http/controllers/whatsapp-webhook.ts",
  ),
  route("/g/$challenge", "shared/http/controllers/google-login.ts"),
  route(
    "/api/v1/google/redirect",
    "shared/http/controllers/google-redirect.ts",
  ),
  route("/api/v1/web/auth/login", "shared/http/controllers/web-auth-login.ts"),
  route(
    "/api/v1/web/auth/logout",
    "shared/http/controllers/web-auth-logout.ts",
  ),
  route("/api/v1/web/auth/me", "shared/http/controllers/web-auth-me.ts"),
  route(
    "/api/v1/web/auth/redirect",
    "shared/http/controllers/web-auth-redirect.ts",
  ),
  route("/api/v1/web/messages", "shared/http/controllers/web-messages.ts"),
  route("/api/v1/web/audio", "shared/http/controllers/web-audio.ts"),
  route("/api/v1/web/todos", "shared/http/controllers/web-todos.ts"),
  route("/api/v1/web/todos/$todoId", "shared/http/controllers/web-todo.ts"),
  route(
    "/api/v1/web/monthly-expenses",
    "shared/http/controllers/web-monthly-expenses.ts",
  ),
  route(
    "/api/v1/web/monthly-expenses/$expenseId",
    "shared/http/controllers/web-monthly-expense.ts",
  ),
  route(
    "/api/v1/web/monthly-expenses/$expenseId/payment",
    "shared/http/controllers/web-monthly-expense-payment.ts",
  ),
]);

export default routes;
