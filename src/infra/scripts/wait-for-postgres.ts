import { execSync } from "child_process";

const container = "the-chatbot-pg";
const maxRetries = 30;
const delayMs = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAcceptingConnections(): boolean {
  try {
    execSync(`docker exec ${container} pg_isready -U local_user -d local_db`, {
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

function canExecuteQuery(): boolean {
  try {
    execSync(
      `docker exec ${container} psql -U local_user -d local_db -c "SELECT 1"`,
      { stdio: "pipe" },
    );
    return true;
  } catch {
    return false;
  }
}

async function waitForPostgres(): Promise<void> {
  for (let i = 1; i <= maxRetries; i++) {
    if (isAcceptingConnections() && canExecuteQuery()) {
      console.log(`PostgreSQL is ready (attempt ${i}/${maxRetries})`);
      return;
    }
    console.log(`Waiting for PostgreSQL... (attempt ${i}/${maxRetries})`);
    await sleep(delayMs);
  }

  console.error(`PostgreSQL did not become ready after ${maxRetries} attempts`);
  process.exit(1);
}

waitForPostgres();
