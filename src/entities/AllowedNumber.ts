import { v4 as uuidv4 } from "uuid";
import { addDigitNine } from "~/entities/PhoneNumberUtils";

export class AllowedNumber {
  id: string;
  phoneNumber: string;
  createdAt: Date;

  constructor(phoneNumber: string) {
    this.id = uuidv4();
    this.createdAt = new Date();
    this.phoneNumber = addDigitNine(phoneNumber);
  }
}
