import type { SpeechToTextGateway, TranscribeAudioDTO } from "./speech-to-text";

export class TestSpeechToTextGateway implements SpeechToTextGateway {
  async transcribeAsync(_dto: TranscribeAudioDTO): Promise<string> {
    return "This is a mock transcript for testing purposes.";
  }
}
