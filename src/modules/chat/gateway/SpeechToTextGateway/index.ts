import type { TranscribeAudioDTO } from "~/modules/chat/entities/dtos/SpeechToTextGatewayDTO";

export type { TranscribeAudioDTO } from "~/modules/chat/entities/dtos/SpeechToTextGatewayDTO";

export interface SpeechToTextGateway {
  transcribeAsync(dto: TranscribeAudioDTO): Promise<string>;
}
