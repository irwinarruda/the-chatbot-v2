import { toStatusResponse } from "~/contracts/http/system/status-mapper";
import { Status } from "~/domain/system/status";

describe("StatusResponseDTO", () => {
  test("maps the application and deployment status", () => {
    const status = new Status(
      "17.5",
      100,
      3,
      "gpt-5",
      "0123456789abcdef0123456789abcdef01234567",
    );

    const response = toStatusResponse(status);

    expect(response.updatedAt).toBe(status.updatedAt.toISOString());
    expect(response.database).toEqual(status.database);
    expect(response.ai).toEqual(status.ai);
    expect(response.deployment).toEqual(status.deployment);
  });
});
