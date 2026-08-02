import type { Credential, CredentialInfo } from "@earendil-works/pi-ai";
import type postgres from "postgres";
import { z } from "zod";
import { AiProviderCredentialDTO } from "~/modules/chat/entities/dtos/AiProviderCredentialDTO";
import type { AiCredentialStore } from "~/modules/chat/gateway/AiCredentialStore";
import type { AiCredentialEncryption } from "~/modules/chat/gateway/AiCredentialStore/AiCredentialEncryption";
import type { DatabaseGateway } from "~/shared/gateway/DatabaseGateway";

const providerIdSchema = z.string().trim().min(1).max(100);
const credentialTypeSchema = z.enum(["api_key", "oauth"]);

export class PostgresAiCredentialStore implements AiCredentialStore {
  constructor(
    private database: DatabaseGateway,
    private encryption: AiCredentialEncryption,
    private idUser: string,
  ) {}

  async read(providerId: string): Promise<Credential | undefined> {
    return this.readCredential(providerIdSchema.parse(providerId));
  }

  async list(): Promise<readonly CredentialInfo[]> {
    const rows = await this.database.sql<DbAiProviderCredentialInfo[]>`
      SELECT provider_id, credential_type
      FROM ai_provider_credentials
      WHERE id_user = ${this.idUser}
      ORDER BY provider_id
    `;
    return rows.map((row) => ({
      providerId: row.provider_id,
      type: credentialTypeSchema.parse(row.credential_type),
    }));
  }

  async modify(
    providerId: string,
    update: (
      current: Credential | undefined,
    ) => Promise<Credential | undefined>,
  ): Promise<Credential | undefined> {
    const parsedProviderId = providerIdSchema.parse(providerId);
    return this.database.transaction(async (sql) => {
      await this.lockCredential(sql, parsedProviderId);
      const current = await this.readCredential(parsedProviderId, sql);
      const candidate = await update(current);
      if (candidate === undefined) return current;
      const credential = AiProviderCredentialDTO.parse(candidate);
      const envelope = this.encryption.encrypt(
        credential,
        this.idUser,
        parsedProviderId,
      );
      await sql`
        INSERT INTO ai_provider_credentials (
          id_user,
          provider_id,
          credential_type,
          credential_envelope
        )
        VALUES (
          ${this.idUser},
          ${parsedProviderId},
          ${credential.type},
          ${sql.json(envelope)}
        )
        ON CONFLICT (id_user, provider_id)
        DO UPDATE SET
          credential_type = EXCLUDED.credential_type,
          credential_envelope = EXCLUDED.credential_envelope,
          updated_at = timezone('utc', now())
      `;
      return credential;
    });
  }

  async delete(providerId: string): Promise<void> {
    const parsedProviderId = providerIdSchema.parse(providerId);
    await this.database.transaction(async (sql) => {
      await this.lockCredential(sql, parsedProviderId);
      await sql`
        DELETE FROM ai_provider_credentials
        WHERE id_user = ${this.idUser}
          AND provider_id = ${parsedProviderId}
      `;
    });
  }

  private async readCredential(
    providerId: string,
    sql: postgres.Sql = this.database.sql,
  ): Promise<Credential | undefined> {
    const rows = await sql<DbAiProviderCredential[]>`
      SELECT credential_envelope
      FROM ai_provider_credentials
      WHERE id_user = ${this.idUser}
        AND provider_id = ${providerId}
    `;
    const row = rows[0];
    if (!row) return undefined;
    return this.encryption.decrypt(
      row.credential_envelope,
      this.idUser,
      providerId,
    );
  }

  private async lockCredential(
    sql: postgres.Sql,
    providerId: string,
  ): Promise<void> {
    const lockKey = `ai-provider-credential:${this.idUser}:${providerId}`;
    await sql`
      SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0::bigint))
    `;
  }
}

interface DbAiProviderCredential {
  credential_envelope: unknown;
}

interface DbAiProviderCredentialInfo {
  provider_id: string;
  credential_type: string;
}
