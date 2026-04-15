export interface AudioInputOption {
  deviceId: string;
  label: string;
}

export const AUDIO_INPUT_STORAGE_KEY = "chat-page-audio-input-device-id";

export function listAudioInputOptions(
  devices: Pick<MediaDeviceInfo, "deviceId" | "kind" | "label">[],
): AudioInputOption[] {
  const audioInputs = devices.filter((device) => device.kind === "audioinput");

  return audioInputs.map((device, index) => ({
    deviceId: device.deviceId,
    label: device.label.trim() || `Microphone ${index + 1}`,
  }));
}

export function resolveSelectedAudioInput(
  devices: AudioInputOption[],
  selectedDeviceId?: string | null,
): string {
  if (
    selectedDeviceId != null &&
    devices.some((device) => device.deviceId === selectedDeviceId)
  ) {
    return selectedDeviceId;
  }

  return devices[0]?.deviceId ?? "";
}

export function getStoredAudioInputDeviceId(
  storage: Pick<Storage, "getItem">,
): string | null {
  return storage.getItem(AUDIO_INPUT_STORAGE_KEY);
}

export function storeAudioInputDeviceId(
  storage: Pick<Storage, "setItem">,
  deviceId: string,
): void {
  storage.setItem(AUDIO_INPUT_STORAGE_KEY, deviceId);
}
