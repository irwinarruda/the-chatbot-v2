import { BsuidUtils } from "~/modules/identity/entities/BsuidUtils";
import { PhoneNumberUtils } from "~/modules/identity/entities/PhoneNumberUtils";

describe("IdentityValues", () => {
  test("normalizes phone numbers and distinguishes BSUID addresses", () => {
    expect(BsuidUtils.containsLetter("BR.13491208655302741918")).toBe(true);
    expect(BsuidUtils.containsLetter("user.98765432109876543210")).toBe(true);
    expect(BsuidUtils.containsLetter("5511984444444")).toBe(false);
    const brazilianWithoutNine = "551184444444";
    expect(PhoneNumberUtils.addDigitNine(brazilianWithoutNine)).toBe(
      "5511984444444",
    );
    expect(PhoneNumberUtils.addDigitNine("5511984444444")).toBe(
      "5511984444444",
    );
    expect(PhoneNumberUtils.addDigitNine("+1 (555) 123-4567")).toBe(
      "15551234567",
    );
    expect(PhoneNumberUtils.addDigitNine("123")).toBe("123");
    expect(PhoneNumberUtils.sanitize("+55 (11) 98444-4444")).toBe(
      "5511984444444",
    );
    expect(PhoneNumberUtils.isValid("1234567")).toBe(false);
    expect(PhoneNumberUtils.isValid("12345678")).toBe(true);
    expect(PhoneNumberUtils.isValid("1".repeat(16))).toBe(false);
  });
});
