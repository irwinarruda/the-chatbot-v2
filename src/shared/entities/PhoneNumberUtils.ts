export class PhoneNumberUtils {
  static addDigitNine(phoneNumber: string): string {
    const sanitized = PhoneNumberUtils.sanitize(phoneNumber);
    const ddiAndDdd = sanitized.length >= 4 ? sanitized.slice(0, 4) : sanitized;
    if (!ddiAndDdd.startsWith("55")) {
      return sanitized;
    }
    if (sanitized.length === 13) {
      return sanitized;
    }
    return `${ddiAndDdd}9${sanitized.slice(4)}`;
  }

  static sanitize(phoneNumber: string): string {
    return phoneNumber.replace(/\D/g, "");
  }

  static isValid(phoneNumber: string): boolean {
    return phoneNumber.length >= 8 && phoneNumber.length <= 15;
  }
}
