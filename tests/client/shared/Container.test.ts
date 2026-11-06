import { describe, expect, test, vi } from "vitest";
import { bootstrapMockContainer } from "~/client/mock/container";
import { container } from "~/client/shared/container";
import { bootstrapAppContainer } from "~/client/shared/container/app";

function registeredKeys(bootstrap: () => void) {
  const register = vi.spyOn(container, "register");
  bootstrap();
  const keys = register.mock.calls.map(([key]) => key).sort();
  register.mockRestore();
  return keys;
}

describe("container", () => {
  test("mock mode registers every port the app registers", () => {
    expect(registeredKeys(bootstrapMockContainer)).toEqual(
      registeredKeys(bootstrapAppContainer),
    );
  });

  test("names the port that was never registered", async () => {
    const { createContainer } = await import("~/client/libs/container");
    expect(() => createContainer().get("TodoRepository")).toThrow(
      'No registration found for "TodoRepository".',
    );
  });
});
