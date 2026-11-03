import type { TranscribeAudioDTO } from "~/domain/chat/speech-to-text";

export type { TranscribeAudioDTO } from "~/domain/chat/speech-to-text";

export interface SpeechToTextGateway {
  transcribeAsync(dto: TranscribeAudioDTO): Promise<string>;
}
