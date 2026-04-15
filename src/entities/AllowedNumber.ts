import { v4 as uuidv4 } from "uuid";
import { PhoneNumberUtils } from "~/entities/PhoneNumberUtils";

export class AllowedNumber {
  id: string;
  phoneNumber: string;
  createdAt: Date;

  constructor(phoneNumber: string) {
    this.id = uuidv4();
    this.createdAt = new Date();
    this.phoneNumber = PhoneNumberUtils.addDigitNine(phoneNumber);
  }

  toJSON() {
    return {
      id: this.id,
      phoneNumber: this.phoneNumber,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
