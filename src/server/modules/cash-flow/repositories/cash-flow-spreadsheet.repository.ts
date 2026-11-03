import { CashFlowSpreadsheet } from "~/domain/cash-flow/cash-flow-spreadsheet";
import type { CashFlowSpreadsheetType } from "~/domain/cash-flow/cash-flow-spreadsheet-type";
import type { DatabaseGateway } from "~/server/shared/database/database";

export class CashFlowSpreadsheetRepository {
  constructor(private readonly database: DatabaseGateway) {}

  async getByUserId(userId: string): Promise<CashFlowSpreadsheet | undefined> {
    const rows = await this.database.sql<DbCashFlowSpreadsheet[]>`
      SELECT * FROM cash_flow_spreadsheets
      WHERE id_user = ${userId}
    `;
    const row = rows[0];
    if (!row) return undefined;
    const sheet = new CashFlowSpreadsheet();
    sheet.id = row.id;
    sheet.idUser = row.id_user;
    sheet.idSheet = row.id_sheet;
    sheet.type = row.type as CashFlowSpreadsheetType;
    sheet.createdAt = row.created_at;
    sheet.updatedAt = row.updated_at;
    return sheet;
  }

  async create(sheet: CashFlowSpreadsheet): Promise<void> {
    await this.database.sql`
      INSERT INTO cash_flow_spreadsheets (id, id_user, id_sheet, type, created_at, updated_at)
      VALUES (${sheet.id}, ${sheet.idUser}, ${sheet.idSheet}, ${sheet.type}, ${sheet.createdAt}, ${sheet.updatedAt})
    `;
  }

  async withLock<T>(sheetId: string, operation: () => Promise<T>): Promise<T> {
    return this.database.transaction(async (sql) => {
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`cash-flow:${sheetId}`}, 0))`;
      return operation();
    });
  }
}

interface DbCashFlowSpreadsheet {
  id: string;
  id_user: string;
  id_sheet: string;
  type: string;
  created_at: Date;
  updated_at: Date;
}
