import {
  AUDIO_INPUT_STORAGE_KEY,
  getStoredAudioInputDeviceId,
  listAudioInputOptions,
  resolveSelectedAudioInput,
  storeAudioInputDeviceId,
} from "~/utils/audioInputDevices";

describe("audioInputDevices", () => {
  test("filters only audio input devices and keeps labels", () => {
    const devices = listAudioInputOptions([
      {
        deviceId: "default",
        kind: "audioinput",
        label: "USB Advanced Audio Device",
      },
      {
        deviceId: "camera",
        kind: "videoinput",
        label: "FaceTime HD Camera",
      },
      {
        deviceId: "builtin",
        kind: "audioinput",
        label: "Microfone (MacBook Pro)",
      },
    ]);

    expect(devices).toEqual([
      {
        deviceId: "default",
        label: "USB Advanced Audio Device",
      },
      {
        deviceId: "builtin",
        label: "Microfone (MacBook Pro)",
      },
    ]);
  });

  test("falls back to generated labels when browser hides device labels", () => {
    const devices = listAudioInputOptions([
      { deviceId: "a", kind: "audioinput", label: "" },
      { deviceId: "b", kind: "audioinput", label: "   " },
    ]);

    expect(devices).toEqual([
      { deviceId: "a", label: "Microphone 1" },
      { deviceId: "b", label: "Microphone 2" },
    ]);
  });

  test("keeps the stored device when it still exists", () => {
    const selectedDeviceId = resolveSelectedAudioInput(
      [
        { deviceId: "usb", label: "USB mic" },
        { deviceId: "builtin", label: "Built-in mic" },
      ],
      "usb",
    );

    expect(selectedDeviceId).toBe("usb");
  });

  test("falls back to the first device when stored device no longer exists", () => {
    const selectedDeviceId = resolveSelectedAudioInput(
      [
        { deviceId: "usb", label: "USB mic" },
        { deviceId: "builtin", label: "Built-in mic" },
      ],
      "missing",
    );

    expect(selectedDeviceId).toBe("usb");
  });

  test("stores and loads the selected device id", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };

    storeAudioInputDeviceId(storage, "usb-device");

    expect(values.get(AUDIO_INPUT_STORAGE_KEY)).toBe("usb-device");
    expect(getStoredAudioInputDeviceId(storage)).toBe("usb-device");
  });
});
