import type { StartAudioRecordingServiceDTO } from "~/client/modules/chat/app/dtos/StartAudioRecordingServiceDTO";

export interface AudioRecordingGateway {
  start(dto: StartAudioRecordingServiceDTO): Promise<boolean>;
  stop(shouldSend: boolean): void;
  isActive(): boolean;
}
