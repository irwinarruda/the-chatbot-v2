import { createMiddleware } from "@tanstack/react-start";
import { ServerBootstrap } from "~/infra/server-bootstrap";

export const bootstrapMiddleware = createMiddleware({
  type: "function",
}).server(async ({ next }) => {
  await ServerBootstrap.ensureBootstrapped();
  return next();
});
