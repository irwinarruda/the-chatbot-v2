export class BsuidUtils {
  static isValid(value: string): boolean {
    return /[A-Za-z]/.test(value);
  }
}
