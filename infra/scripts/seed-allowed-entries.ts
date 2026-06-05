import { resolve } from "path";
import postgres from "postgres";
import { loadModeEnv, resolveMode } from "../../plugins/env";

const root = resolve(import.meta.dirname, "..", "..");
const mode = resolveMode(process.env.MODE ?? "development");

loadModeEnv(mode, root);

const connectionString = process.env.DATABASE_CONNECTION_STRING;
const address = process.env.STARTING_ALLOWED_ADDRESS;
if (!connectionString) {
  throw new Error("DATABASE_CONNECTION_STRING is not set");
}
if (!address) {
  console.log("STARTING_ALLOWED_ADDRESS not set, skipping seed");
  process.exit(0);
}
const sql = postgres(connectionString);
await sql`
  INSERT INTO allowed_entries (channel, channel_address)
  VALUES (${"WhatsApp"}, ${address})
  ON CONFLICT DO NOTHING
`;
console.log(`Seeded allowed entry WhatsApp ID: ${address}`);
await sql.end();
