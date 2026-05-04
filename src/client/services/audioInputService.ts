import type { AudioInputOption } from "~/client/entities/AudioInputOption";

const STORAGE_KEY = "chat-page-audio-input-device-id";

export const audioInputService = {
  async listAudioInputs(): Promise<AudioInputOption[]> {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.enumerateDevices
    ) {
      return [];
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(
        (device) => device.kind === "audioinput",
      );
      return audioInputs.map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label.trim() || `Microphone ${index + 1}`,
      }));
    } catch {
      return [];
    }
  },

  resolveSelected(
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
  },

  getStoredDeviceId(): string | undefined {
    if (typeof window === "undefined") return undefined;
    return window.localStorage.getItem(STORAGE_KEY) ?? undefined;
  },

  storeDeviceId(deviceId: string): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, deviceId);
  },

  subscribeToDeviceChanges(callback: () => void): () => void {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.addEventListener
    ) {
      return () => {};
    }
    navigator.mediaDevices.addEventListener("devicechange", callback);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", callback);
    };
  },
};
