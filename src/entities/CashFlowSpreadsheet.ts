import { v4 as uuidv4 } from "uuid";
import { CashFlowSpreadsheetType } from "~/entities/enums/CashFlowSpreadsheetType";

export class CashFlowSpreadsheet {
  id: string;
  idUser: string;
  idSheet: string;
  type: CashFlowSpreadsheetType;
  createdAt: Date;
  updatedAt: Date;

  constructor() {
    this.id = uuidv4();
    this.idUser = "";
    this.idSheet = "";
    this.type = CashFlowSpreadsheetType.Google;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}
