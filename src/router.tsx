import { createRouter } from "@tanstack/react-router";
import { bootstrapAppContainer } from "~/client/shared/container/app";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  bootstrapAppContainer();
  const router = createRouter({ routeTree, scrollRestoration: true });
  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
