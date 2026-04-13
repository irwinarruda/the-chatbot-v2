export interface AudioInputOption {
  deviceId: string;
  label: string;
}

interface DeviceIdReader {
  getItem: (key: string) => string | undefined;
}

export class AudioInputDevices {
  static readonly StorageKey = "chat-page-audio-input-device-id";

  static listOptions(
    devices: Pick<MediaDeviceInfo, "deviceId" | "kind" | "label">[],
  ): AudioInputOption[] {
    const audioInputs = devices.filter(
      (device) => device.kind === "audioinput",
    );

    return audioInputs.map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label.trim() || `Microphone ${index + 1}`,
    }));
  }

  static resolveSelected(
    devices: AudioInputOption[],
    selectedDeviceId?: string,
  ): string {
    if (
      selectedDeviceId &&
      devices.some((device) => device.deviceId === selectedDeviceId)
    ) {
      return selectedDeviceId;
    }

    return devices[0]?.deviceId ?? "";
  }

  static getStoredDeviceId(storage: DeviceIdReader): string | undefined {
    return storage.getItem(AudioInputDevices.StorageKey);
  }

  static storeDeviceId(
    storage: Pick<Storage, "setItem">,
    deviceId: string,
  ): void {
    storage.setItem(AudioInputDevices.StorageKey, deviceId);
  }
}
