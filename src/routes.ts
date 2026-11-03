import { index, rootRoute, route } from "@tanstack/virtual-file-routes";

export const routes = rootRoute("client/routes/__root.tsx", [
  index("client/routes/index.tsx"),
  route("/privacy", "client/routes/privacy.tsx"),
  route("/login", "client/routes/login.tsx"),
  route("/not-registered", "client/routes/not-registered.tsx"),
  route("/chat", [index("client/routes/chat/index.tsx")]),
  route("/todo", "client/routes/todo.tsx", [
    index("client/routes/todo/index.tsx"),
    route("/$todoId", "client/routes/todo/$todoId.tsx"),
  ]),
  route("/notes", "client/routes/notes.tsx", [
    index("client/routes/notes/index.tsx"),
    route("/$noteId", "client/routes/notes/$noteId.tsx"),
  ]),
  route("/artifacts", "client/routes/artifacts.tsx"),
  route("/a/$artifactId", "client/routes/a/$artifactId.tsx"),
  route("/cash-flow", "client/routes/cash-flow.tsx"),
  route("/bills", "client/routes/bills.tsx"),
  route("/google", [
    route("/already-signed-in", "client/routes/google/already-signed-in.tsx"),
    route("/thank-you", "client/routes/google/thank-you.tsx"),
  ]),
  route(
    "/api/v1/status",
    "server/modules/system/controllers/status.controller.ts",
  ),
  route(
    "/api/v1/migration",
    "server/modules/system/controllers/migration.controller.ts",
  ),
  route(
    "/api/v1/whatsapp/webhook",
    "server/modules/chat/controllers/whatsapp-webhook.controller.ts",
  ),
  route(
    "/g/$challenge",
    "server/modules/accounts/controllers/google-login.controller.ts",
  ),
  route(
    "/api/v1/google/redirect",
    "server/modules/accounts/controllers/google-redirect.controller.ts",
  ),
  route(
    "/api/v1/web/auth/login",
    "server/modules/accounts/controllers/web-auth-login.controller.ts",
  ),
  route(
    "/api/v1/web/auth/logout",
    "server/modules/accounts/controllers/web-auth-logout.controller.ts",
  ),
  route(
    "/api/v1/web/auth/me",
    "server/modules/accounts/controllers/web-auth-me.controller.ts",
  ),
  route(
    "/api/v1/web/auth/redirect",
    "server/modules/accounts/controllers/web-auth-redirect.controller.ts",
  ),
  route(
    "/api/v1/web/messages",
    "server/modules/chat/controllers/web-messages.controller.ts",
  ),
  route(
    "/api/v1/web/audio",
    "server/modules/chat/controllers/web-audio.controller.ts",
  ),
  route(
    "/api/v1/web/cash-flow",
    "server/modules/cash-flow/controllers/web-cash-flow.controller.ts",
  ),
  route(
    "/api/v1/web/cash-flow/transactions",
    "server/modules/cash-flow/controllers/web-cash-flow-transactions.controller.ts",
  ),
  route(
    "/api/v1/web/cash-flow/transactions/last",
    "server/modules/cash-flow/controllers/web-cash-flow-last-transaction.controller.ts",
  ),
  route(
    "/api/v1/web/cash-flow/sync",
    "server/modules/cash-flow/controllers/web-cash-flow-sync.controller.ts",
  ),
  route(
    "/api/v1/web/cash-flow/transfers",
    "server/modules/cash-flow/controllers/web-cash-flow-transfers.controller.ts",
  ),
  route(
    "/api/v1/web/cash-flow/transfers/$transferId",
    "server/modules/cash-flow/controllers/web-cash-flow-transfer.controller.ts",
  ),
  route(
    "/api/v1/web/monthly-expenses/$expenseId/bank-payment",
    "server/modules/cash-flow/controllers/web-monthly-expense-bank-payment.controller.ts",
  ),
  route(
    "/api/v1/web/todos",
    "server/modules/todos/controllers/web-todos.controller.ts",
  ),
  route(
    "/api/v1/web/todos/$todoId",
    "server/modules/todos/controllers/web-todo.controller.ts",
  ),
  route(
    "/api/v1/web/notes",
    "server/modules/notes/controllers/web-notes.controller.ts",
  ),
  route(
    "/api/v1/web/notes/refine",
    "server/modules/notes/controllers/web-note-refinement.controller.ts",
  ),
  route(
    "/api/v1/web/notes/$noteId",
    "server/modules/notes/controllers/web-note.controller.ts",
  ),
  route(
    "/api/v1/artifacts",
    "server/modules/artifacts/controllers/artifacts.controller.ts",
  ),
  route(
    "/api/v1/artifacts/$artifactId",
    "server/modules/artifacts/controllers/artifact.controller.ts",
  ),
  route(
    "/api/v1/web/artifacts",
    "server/modules/artifacts/controllers/web-artifacts.controller.ts",
  ),
  route(
    "/api/v1/web/artifacts/token",
    "server/modules/artifacts/controllers/web-artifact-token.controller.ts",
  ),
  route(
    "/api/v1/web/artifacts/$artifactId",
    "server/modules/artifacts/controllers/web-artifact.controller.ts",
  ),
  route(
    "/api/v1/web/monthly-expenses",
    "server/modules/cash-flow/controllers/web-monthly-expenses.controller.ts",
  ),
  route(
    "/api/v1/web/monthly-expenses/$expenseId",
    "server/modules/cash-flow/controllers/web-monthly-expense.controller.ts",
  ),
  route(
    "/api/v1/web/monthly-expenses/$expenseId/payment",
    "server/modules/cash-flow/controllers/web-monthly-expense-payment.controller.ts",
  ),
]);

export default routes;
