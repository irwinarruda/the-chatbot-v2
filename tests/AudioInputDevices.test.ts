import { describe, expect, test } from "vitest";
import { audioInputService } from "~/client/services/audioInputService";

describe("audioInputService", () => {
  test("keeps the stored device when it still exists", () => {
    const selectedDeviceId = audioInputService.resolveSelected(
      [
        { deviceId: "usb", label: "USB mic" },
        { deviceId: "builtin", label: "Built-in mic" },
      ],
      "usb",
    );

    expect(selectedDeviceId).toBe("usb");
  });

  test("falls back to the first device when stored device no longer exists", () => {
    const selectedDeviceId = audioInputService.resolveSelected(
      [
        { deviceId: "usb", label: "USB mic" },
        { deviceId: "builtin", label: "Built-in mic" },
      ],
      "missing",
    );

    expect(selectedDeviceId).toBe("usb");
  });

  test("returns empty string when device list is empty", () => {
    const selectedDeviceId = audioInputService.resolveSelected([], "any");

    expect(selectedDeviceId).toBe("");
  });

  test("returns first device when no preferred id is provided", () => {
    const selectedDeviceId = audioInputService.resolveSelected([
      { deviceId: "usb", label: "USB mic" },
    ]);

    expect(selectedDeviceId).toBe("usb");
  });
});
