import type postgres from "postgres";
import {
  type AiModelPreferenceDTO as AiModelPreference,
  AiModelPreferenceDTO,
} from "~/modules/chat/entities/dtos/AiModelPreferenceDTO";
import type { DatabaseGateway } from "~/shared/gateway/DatabaseGateway";

export class AiModelPreferenceService {
  constructor(private database: DatabaseGateway) {}

  async getForUser(idUser: string): Promise<AiModelPreference | undefined> {
    const rows = await this.database.sql<DbAiModelPreference[]>`
      SELECT id_user, provider_id, model_id
      FROM ai_model_preferences
      WHERE id_user = ${idUser}
    `;
    const row = rows[0];
    if (!row) return undefined;
    return AiModelPreferenceDTO.parse({
      idUser: row.id_user,
      providerId: row.provider_id,
      modelId: row.model_id,
    });
  }

  async save(
    preference: AiModelPreference,
    sql: postgres.Sql = this.database.sql,
  ): Promise<AiModelPreference> {
    const parsed = AiModelPreferenceDTO.parse(preference);
    await sql`
      INSERT INTO ai_model_preferences (id_user, provider_id, model_id)
      VALUES (${parsed.idUser}, ${parsed.providerId}, ${parsed.modelId})
      ON CONFLICT (id_user)
      DO UPDATE SET
        provider_id = EXCLUDED.provider_id,
        model_id = EXCLUDED.model_id,
        updated_at = timezone('utc', now())
    `;
    return parsed;
  }

  async clearForUser(idUser: string): Promise<void> {
    await this.database.sql`
      DELETE FROM ai_model_preferences
      WHERE id_user = ${idUser}
    `;
  }
}

interface DbAiModelPreference {
  id_user: string;
  provider_id: string;
  model_id: string;
}
