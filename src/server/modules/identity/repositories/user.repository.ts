import { Credential } from "~/domain/identity/credentials";
import { User } from "~/domain/identity/user";
import type { GoogleCredentialEncryptionService } from "~/server/modules/identity/utils/google-credential-encryption";
import type {
  DatabaseGateway,
  DatabaseGatewaySql,
} from "~/server/shared/database/database";

export class UserRepository {
  constructor(
    private readonly database: DatabaseGateway,
    private readonly encryption: GoogleCredentialEncryptionService,
  ) {}

  async list(): Promise<User[]> {
    const rows = await this.database.sql<DbUser[]>`SELECT * FROM users`;
    const users: User[] = [];
    for (const row of rows) users.push(await this.hydrate(row));
    return users;
  }

  async findById(id: string): Promise<User | undefined> {
    const rows = await this.database.sql<DbUser[]>`
      SELECT * FROM users
      WHERE id = ${id}
    `;
    return this.hydrateFirst(rows);
  }

  async findByPhoneNumber(phoneNumber: string): Promise<User | undefined> {
    const rows = await this.database.sql<DbUser[]>`
      SELECT * FROM users
      WHERE phone_number = ${phoneNumber}
    `;
    return this.hydrateFirst(rows);
  }

  async findByBsuid(bsuid: string): Promise<User | undefined> {
    const rows = await this.database.sql<DbUser[]>`
      SELECT * FROM users
      WHERE bsuid = ${bsuid}
    `;
    return this.hydrateFirst(rows);
  }

  async findByEmail(
    email: string,
    sql: DatabaseGatewaySql = this.database.sql,
  ): Promise<User | undefined> {
    const rows = await sql<DbUser[]>`
      SELECT * FROM users
      WHERE lower(email) = ${email.toLowerCase()}
    `;
    return this.hydrateFirst(rows, sql);
  }

  async findByChannelAddress(
    channelAddress: string,
    sql: DatabaseGatewaySql = this.database.sql,
  ): Promise<User | undefined> {
    const rows = await sql<DbUser[]>`
      SELECT * FROM users
      WHERE bsuid = ${channelAddress}
        OR phone_number = ${channelAddress}
        OR lower(email) = ${channelAddress.toLowerCase()}
      LIMIT 1
    `;
    return this.hydrateFirst(rows, sql);
  }

  async create(
    user: User,
    sql: DatabaseGatewaySql = this.database.sql,
  ): Promise<void> {
    const email = user.email ?? null;
    const phoneNumber = user.phoneNumber ?? null;
    const bsuid = user.bsuid ?? null;
    await sql`
      INSERT INTO users (id, name, phone_number, email, bsuid, created_at, updated_at)
      VALUES (${user.id}, ${user.name}, ${phoneNumber}, ${email}, ${bsuid}, ${user.createdAt}, ${user.updatedAt})
    `;
    if (user.googleCredential) {
      await this.createCredential(user.googleCredential, sql);
    }
  }

  async save(
    user: User,
    sql: DatabaseGatewaySql = this.database.sql,
  ): Promise<void> {
    const email = user.email ?? null;
    const phoneNumber = user.phoneNumber ?? null;
    const bsuid = user.bsuid ?? null;
    await sql`
      UPDATE users
      SET
        name = ${user.name},
        email = ${email},
        phone_number = ${phoneNumber},
        bsuid = ${bsuid},
        is_inactive = ${user.isInactive},
        updated_at = ${user.updatedAt}
      WHERE id = ${user.id}
    `;
  }

  async createCredential(
    googleCredential: Credential,
    sql: DatabaseGatewaySql = this.database.sql,
  ): Promise<void> {
    const expiresInSeconds = googleCredential.expiresInSeconds ?? null;
    const expirationDate = googleCredential.expirationDate ?? null;
    const tokenEnvelope = this.encryption.encrypt(googleCredential);
    await sql`
      INSERT INTO google_credentials (
        id,
        id_user,
        token_envelope,
        expires_in_seconds,
        expiration_date,
        created_at,
        updated_at
      )
      VALUES (
        ${googleCredential.id},
        ${googleCredential.idUser},
        ${sql.json(tokenEnvelope)},
        ${expiresInSeconds},
        ${expirationDate},
        ${googleCredential.createdAt},
        ${googleCredential.updatedAt}
      )
    `;
  }

  async saveCredential(
    googleCredential: Credential,
    sql: DatabaseGatewaySql = this.database.sql,
  ): Promise<void> {
    const expiresInSeconds = googleCredential.expiresInSeconds ?? null;
    const expirationDate = googleCredential.expirationDate ?? null;
    const tokenEnvelope = this.encryption.encrypt(googleCredential);
    await sql`
      UPDATE google_credentials
      SET
        token_envelope = ${sql.json(tokenEnvelope)},
        expires_in_seconds = ${expiresInSeconds},
        expiration_date = ${expirationDate},
        updated_at = ${googleCredential.updatedAt}
      WHERE id = ${googleCredential.id}
    `;
  }

  async deleteById(id: string): Promise<void> {
    await this.database.sql`
      DELETE FROM users
      WHERE id = ${id}
    `;
  }

  async deleteByChannelAddress(channelAddress: string): Promise<void> {
    await this.database.sql`
      DELETE FROM users
      WHERE id = (
        SELECT id FROM users
        WHERE bsuid = ${channelAddress}
          OR phone_number = ${channelAddress}
          OR lower(email) = ${channelAddress.toLowerCase()}
        LIMIT 1
      );
    `;
  }

  private async hydrateFirst(
    rows: DbUser[],
    sql: DatabaseGatewaySql = this.database.sql,
  ): Promise<User | undefined> {
    const row = rows[0];
    if (!row) return undefined;
    return this.hydrate(row, sql);
  }

  private async hydrate(
    dbUser: DbUser,
    sql: DatabaseGatewaySql = this.database.sql,
  ): Promise<User> {
    const dbCredentials = await sql<DbGoogleCredential[]>`
      SELECT * FROM google_credentials
      WHERE id_user = ${dbUser.id}
    `;
    const dbCred = dbCredentials[0];
    let googleCredential: Credential | undefined;
    if (dbCred) {
      const { accessToken, refreshToken } = this.encryption.decrypt(
        dbCred.token_envelope,
        dbCred.id,
        dbCred.id_user,
      );
      googleCredential = Credential.restore({
        id: dbCred.id,
        idUser: dbCred.id_user,
        accessToken,
        refreshToken,
        expiresInSeconds: dbCred.expires_in_seconds ?? undefined,
        expirationDate: dbCred.expiration_date ?? undefined,
        createdAt: dbCred.created_at,
        updatedAt: dbCred.updated_at,
      });
    }
    return User.restore({
      id: dbUser.id,
      name: dbUser.name,
      phoneNumber: dbUser.phone_number ?? undefined,
      email: dbUser.email ?? undefined,
      bsuid: dbUser.bsuid ?? undefined,
      isInactive: dbUser.is_inactive,
      createdAt: dbUser.created_at,
      updatedAt: dbUser.updated_at,
      googleCredential,
    });
  }
}

interface DbUser {
  id: string;
  name: string;
  phone_number: string | null;
  email: string | null;
  bsuid: string | null;
  is_inactive: boolean;
  created_at: Date;
  updated_at: Date;
}

interface DbGoogleCredential {
  id: string;
  id_user: string;
  token_envelope: unknown;
  expires_in_seconds: number | null;
  expiration_date: Date | null;
  created_at: Date;
  updated_at: Date;
}
