import { createRouter } from "@tanstack/react-router";
import { bootstrapMockContainer } from "~/client/mock/container";
import { routeTree } from "~/routeTree.gen";

export function getRouter() {
  bootstrapMockContainer();
  const router = createRouter({ routeTree, scrollRestoration: true });
  return router;
}
