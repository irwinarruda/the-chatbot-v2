import { StartAppGoogleLoginRequestDTO } from "~/modules/identity/entities/dtos/GoogleAuthDTO";

describe("StartAppGoogleLoginRequestDTO", () => {
  test("accepts a 16-byte base64url challenge", () => {
    const challenge = "A".repeat(22);

    expect(StartAppGoogleLoginRequestDTO.parse({ challenge })).toEqual({
      challenge,
    });
  });

  test("rejects a raw WhatsApp address", () => {
    expect(() =>
      StartAppGoogleLoginRequestDTO.parse({ challenge: "5511984444444" }),
    ).toThrow();
  });

  test("rejects missing challenges", () => {
    expect(() => StartAppGoogleLoginRequestDTO.parse({})).toThrow();
  });
});
