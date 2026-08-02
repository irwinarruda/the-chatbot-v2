import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import type { Credential } from "@earendil-works/pi-ai";
import { z } from "zod";
import { Database } from "~/infra/database";
import { AiCredentialEncryption } from "~/modules/chat/gateway/AiCredentialStore/AiCredentialEncryption";
import { PostgresAiCredentialStore } from "~/modules/chat/gateway/AiCredentialStore/PostgresAiCredentialStore";
import { loadConfig } from "~/shared/config/Config";
import { loadModeEnv, resolveMode } from "../../plugins/env";

const piAuthSchema = z.object({
  "zai-coding-cn": z.object({
    type: z.literal("api_key"),
    key: z.string().min(1),
  }),
});

const codexAuthSchema = z.object({
  tokens: z.object({
    access_token: z.string().min(1),
    refresh_token: z.string().min(1),
    account_id: z.string().min(1),
  }),
});

const jwtPayloadSchema = z.object({ exp: z.number().int().positive() });

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    throw new Error(`Could not read a valid local credential file: ${path}`);
  }
}

function jwtExpiresAt(accessToken: string): number {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) throw new Error();
    const parsed = jwtPayloadSchema.parse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
    );
    return parsed.exp * 1000;
  } catch {
    throw new Error("The local Codex access token has no valid expiry");
  }
}

function userIdArgument(): string | undefined {
  const index = process.argv.indexOf("--user-id");
  if (index === -1) return undefined;
  const idUser = process.argv[index + 1];
  if (!idUser) return undefined;
  return z.uuid().parse(idUser);
}

function userEmailArgument(): string | undefined {
  const index = process.argv.indexOf("--email");
  if (index === -1) return undefined;
  const email = process.argv[index + 1];
  if (!email) return undefined;
  return z.email().parse(email);
}

async function resolveUserId(
  database: Database,
  requestedId: string | undefined,
  requestedEmail: string | undefined,
): Promise<string> {
  if (requestedId && requestedEmail) {
    throw new Error("Pass either --user-id or --email, not both");
  }
  let rows: Array<{ id: string }>;
  if (requestedId) {
    rows = await database.sql`
      SELECT id FROM users WHERE id = ${requestedId} AND is_inactive = false
    `;
  } else if (requestedEmail) {
    rows = await database.sql`
      SELECT id
      FROM users
      WHERE LOWER(email) = LOWER(${requestedEmail}) AND is_inactive = false
    `;
  } else {
    rows = await database.sql`
      SELECT id FROM users WHERE is_inactive = false ORDER BY created_at
    `;
  }
  if (rows.length !== 1) {
    let message = "Expected exactly one active user; pass --user-id explicitly";
    if (requestedEmail) {
      message =
        "The requested active user email was not found or was ambiguous";
    }
    if (requestedId) message = "The requested active user was not found";
    throw new Error(message);
  }
  const user = rows[0];
  if (!user) throw new Error("The active user could not be resolved");
  return user.id;
}

async function localCredentials(): Promise<
  Array<{ providerId: string; credential: Credential }>
> {
  let pi: z.infer<typeof piAuthSchema>;
  let codex: z.infer<typeof codexAuthSchema>;
  try {
    pi = piAuthSchema.parse(
      await readJson(resolve(homedir(), ".pi", "agent", "auth.json")),
    );
    codex = codexAuthSchema.parse(
      await readJson(resolve(homedir(), ".codex", "auth.json")),
    );
  } catch {
    throw new Error("Local Pi or Codex credentials have an unsupported shape");
  }
  return [
    {
      providerId: "zai-coding-cn",
      credential: pi["zai-coding-cn"],
    },
    {
      providerId: "openai-codex",
      credential: {
        type: "oauth",
        access: codex.tokens.access_token,
        refresh: codex.tokens.refresh_token,
        expires: jwtExpiresAt(codex.tokens.access_token),
        accountId: codex.tokens.account_id,
      },
    },
  ];
}

const root = resolve(import.meta.dirname, "..", "..");
const mode = resolveMode(process.env.MODE ?? "development");
loadModeEnv(mode, root);
const config = loadConfig();
const database = new Database(config.database.connectionString);

try {
  const idUser = await resolveUserId(
    database,
    userIdArgument(),
    userEmailArgument(),
  );
  const encryption = new AiCredentialEncryption(
    config.credentialEncryption.key,
  );
  const store = new PostgresAiCredentialStore(database, encryption, idUser);
  for (const { providerId, credential } of await localCredentials()) {
    await store.modify(providerId, async () => credential);
    console.log(`[imported] ${providerId}: ${credential.type}`);
  }
} catch (error) {
  let message = "Unknown import error";
  if (error instanceof Error) message = error.message;
  console.error(`[failed] ${message}`);
  process.exitCode = 1;
} finally {
  await database.close();
}
