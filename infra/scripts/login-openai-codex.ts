import { createInterface } from "node:readline/promises";
import type { AuthInteraction, AuthPrompt } from "@earendil-works/pi-ai";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import { z } from "zod";
import { Database } from "~/infra/database";
import { AiCredentialEncryption } from "~/modules/chat/gateway/AiCredentialStore/AiCredentialEncryption";
import { PostgresAiCredentialStore } from "~/modules/chat/gateway/AiCredentialStore/PostgresAiCredentialStore";
import { loadConfig } from "~/shared/config/Config";
import { loadModeEnv, resolveMode } from "../../plugins/env";

function userIdArgument(): string | undefined {
  const index = process.argv.indexOf("--user-id");
  if (index === -1) return undefined;
  const idUser = process.argv[index + 1];
  if (!idUser) return undefined;
  return z.uuid().parse(idUser);
}

async function resolveUserId(
  database: Database,
  requestedId: string | undefined,
): Promise<string> {
  let rows: Array<{ id: string }>;
  if (requestedId) {
    rows = await database.sql`
      SELECT id FROM users WHERE id = ${requestedId} AND is_inactive = false
    `;
  } else {
    rows = await database.sql`
      SELECT id FROM users WHERE is_inactive = false ORDER BY created_at
    `;
  }
  if (rows.length !== 1) {
    let message = "Expected exactly one active user; pass --user-id explicitly";
    if (requestedId) message = "The requested active user was not found";
    throw new Error(message);
  }
  const user = rows[0];
  if (!user) throw new Error("The active user could not be resolved");
  return user.id;
}

function promptLabel(prompt: AuthPrompt): string {
  if (prompt.type !== "select") return prompt.message;
  return `${prompt.message}\n${prompt.options
    .map((option) => `${option.id}: ${option.label}`)
    .join("\n")}`;
}

const mode = resolveMode(process.env.MODE ?? "development");
loadModeEnv(mode);
const config = loadConfig();
const database = new Database(config.database.connectionString);
const terminal = createInterface({
  input: process.stdin,
  output: process.stdout,
});

try {
  const idUser = await resolveUserId(database, userIdArgument());
  const store = new PostgresAiCredentialStore(
    database,
    new AiCredentialEncryption(config.credentialEncryption.key),
    idUser,
  );
  const models = builtinModels({
    credentials: store,
    authContext: {
      env: async () => undefined,
      fileExists: async () => false,
    },
  });
  const interaction: AuthInteraction = {
    prompt: async (prompt) => terminal.question(`${promptLabel(prompt)}\n> `),
    notify: (event) => {
      if (event.type === "auth_url") {
        console.log(`[authorize] ${event.url}`);
        if (event.instructions) console.log(event.instructions);
        return;
      }
      if (event.type === "device_code") {
        console.log(`[authorize] ${event.verificationUri}`);
        console.log(`[device-code] ${event.userCode}`);
        return;
      }
      console.log(`[${event.type}] ${event.message}`);
      if (event.type === "info") {
        for (const link of event.links ?? []) console.log(link.url);
      }
    },
  };
  await models.login("openai-codex", "oauth", interaction);
  console.log("[connected] openai-codex: oauth");
} catch {
  console.error("[failed] OpenAI Codex login did not complete");
  process.exitCode = 1;
} finally {
  terminal.close();
  await database.close();
}
