export function addDigitNine(phoneNumber: string): string {
  phoneNumber = sanitize(phoneNumber);
  const ddiAndDdd =
    phoneNumber.length >= 4 ? phoneNumber.slice(0, 4) : phoneNumber;
  if (!ddiAndDdd.startsWith("55")) {
    return phoneNumber;
  }
  if (phoneNumber.length === 13) {
    return phoneNumber;
  }
  return `${ddiAndDdd}9${phoneNumber.slice(4)}`;
}

export function sanitize(phoneNumber: string): string {
  return phoneNumber.replace(/\D/g, "");
}

export function isValid(phoneNumber: string): boolean {
  return phoneNumber.length >= 8 && phoneNumber.length <= 15;
}
