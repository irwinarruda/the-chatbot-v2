import { config } from "dotenv";
import { join, resolve } from "path";
import postgres from "postgres";

const root = resolve(import.meta.dirname, "..", "..");
const mode = process.env.MODE ?? "local";

config({ path: join(root, ".env") });
config({ path: join(root, `.env.${mode}`), override: true });

const connectionString = process.env.DATABASE_CONNECTION_STRING;
const phoneNumber = process.env.STARTING_ALLOWED_PHONE_NUMBER;

if (!connectionString) {
  throw new Error("DATABASE_CONNECTION_STRING is not set");
}

if (!phoneNumber) {
  console.log("STARTING_ALLOWED_PHONE_NUMBER not set, skipping seed");
  process.exit(0);
}

const sql = postgres(connectionString);

await sql`
  INSERT INTO allowed_numbers (phone_number)
  VALUES (${phoneNumber})
  ON CONFLICT (phone_number) DO NOTHING
`;
console.log(`Seeded allowed number: ${phoneNumber}`);
await sql.end();
