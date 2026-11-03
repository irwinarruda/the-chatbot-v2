import { createHash, randomBytes, randomUUID } from "node:crypto";
import type {
  DatabaseGateway,
  DatabaseGatewaySql,
} from "~/server/shared/database/database";

export interface GoogleAuthChallenge {
  id: string;
  channelAddress: string;
}

export class GoogleAuthChallengeRepository {
  constructor(private readonly database: DatabaseGateway) {}

  async issue(channelAddress: string, ttlMs: number): Promise<string> {
    const challenge = randomBytes(16).toString("base64url");
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + ttlMs);
    await this.database.sql`
      DELETE FROM google_auth_challenges
      WHERE expires_at <= NOW()
    `;
    await this.database.sql`
      INSERT INTO google_auth_challenges (
        id,
        token_hash,
        channel_address,
        expires_at,
        created_at
      )
      VALUES (
        ${randomUUID()},
        ${hashChallenge(challenge)},
        ${channelAddress},
        ${expiresAt},
        ${createdAt}
      )
    `;
    return challenge;
  }

  async findActive(
    challenge: string,
    sql: DatabaseGatewaySql = this.database.sql,
    isLocked = false,
  ): Promise<GoogleAuthChallenge | undefined> {
    const tokenHash = hashChallenge(challenge);
    let rows: DbGoogleAuthChallenge[];
    if (isLocked) {
      rows = await sql<DbGoogleAuthChallenge[]>`
        SELECT *
        FROM google_auth_challenges
        WHERE token_hash = ${tokenHash}
          AND consumed_at IS NULL
          AND expires_at > NOW()
        FOR UPDATE
      `;
    } else {
      rows = await sql<DbGoogleAuthChallenge[]>`
        SELECT *
        FROM google_auth_challenges
        WHERE token_hash = ${tokenHash}
          AND consumed_at IS NULL
          AND expires_at > NOW()
      `;
    }
    const row = rows[0];
    if (!row) return undefined;
    return { id: row.id, channelAddress: row.channel_address };
  }

  async consume(id: string, sql: DatabaseGatewaySql): Promise<void> {
    await sql`
      UPDATE google_auth_challenges
      SET consumed_at = ${new Date()}
      WHERE id = ${id}
    `;
  }

  async consumeActive(challenge: string): Promise<boolean> {
    const consumed = await this.database.sql<{ id: string }[]>`
      UPDATE google_auth_challenges
      SET consumed_at = ${new Date()}
      WHERE token_hash = ${hashChallenge(challenge)}
        AND consumed_at IS NULL
        AND expires_at > NOW()
      RETURNING id
    `;
    return consumed.length > 0;
  }
}

function hashChallenge(challenge: string): Buffer {
  return createHash("sha256").update(challenge).digest();
}

interface DbGoogleAuthChallenge {
  id: string;
  token_hash: Buffer;
  channel_address: string;
  expires_at: Date;
  consumed_at: Date | null;
  created_at: Date;
}
