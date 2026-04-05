import type { Config } from "~/infra/config";
import type { IWhatsAppMessagingGateway } from "~/resources/IWhatsAppMessagingGateway";
import { TuiWhatsAppMessagingGateway } from "~/resources/TuiWhatsAppMessagingGateway";

type TuiRuntimeConfig = Pick<Config, "mode" | "nodeEnv">;

export function isTuiRuntimeAvailable(config: TuiRuntimeConfig): boolean {
  return config.mode === "tui" && config.nodeEnv !== "production";
}

export function shouldUseTuiGateway(config: TuiRuntimeConfig): boolean {
  return isTuiRuntimeAvailable(config);
}

export function createTuiDisabledResponse(): Response {
  return new Response(JSON.stringify({ error: "Not Found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

export function requireTuiGateway(
  gateway: IWhatsAppMessagingGateway,
): Response | TuiWhatsAppMessagingGateway {
  if (
    !isTuiRuntimeAvailable({
      mode: (process.env.MODE ?? "local") as Config["mode"],
      nodeEnv: (process.env.NODE_ENV ?? "development") as Config["nodeEnv"],
    }) ||
    !(gateway instanceof TuiWhatsAppMessagingGateway)
  ) {
    return createTuiDisabledResponse();
  }

  return gateway;
}
