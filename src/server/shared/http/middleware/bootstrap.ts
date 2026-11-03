import { createMiddleware } from "@tanstack/react-start";
import { getServer } from "~/server/production";

export const bootstrapMiddleware = createMiddleware({
  type: "function",
}).server(async ({ next }) => {
  getServer();
  return next();
});
