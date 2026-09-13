import { Generator, getConfig } from "@tanstack/router-generator";
import { routes } from "~/shared/http";

const root = process.cwd();
const config = getConfig(
  {
    routesDirectory: "./src",
    generatedRouteTree: "./src/routeTree.gen.ts",
    virtualRouteConfig: routes,
    routeTreeFileFooter: [
      'import type { getRouter } from "./router";',
      'import type { startInstance } from "./start";',
      'declare module "@tanstack/react-start" {',
      "  interface Register {",
      "    ssr: true;",
      "    router: Awaited<ReturnType<typeof getRouter>>;",
      "    config: Awaited<ReturnType<typeof startInstance.getOptions>>;",
      "  }",
      "}",
    ],
  },
  root,
);

await new Generator({ config, root }).run();
