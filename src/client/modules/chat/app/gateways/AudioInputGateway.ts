import type { AudioInputOption } from "~/client/modules/chat/app/entities/AudioInputOption";

export interface AudioInputGateway {
  listAudioInputs(): Promise<AudioInputOption[]>;
  resolveSelected(
    devices: AudioInputOption[],
    selectedDeviceId?: string,
  ): string;
  getStoredDeviceId(): string | undefined;
  storeDeviceId(deviceId: string): void;
  subscribeToDeviceChanges(callback: () => void): () => void;
}
