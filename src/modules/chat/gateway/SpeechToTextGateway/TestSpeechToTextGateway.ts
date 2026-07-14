import type {
  SpeechToTextGateway,
  TranscribeAudioDTO,
} from "~/modules/chat/gateway/SpeechToTextGateway";

export class TestSpeechToTextGateway implements SpeechToTextGateway {
  async transcribeAsync(_dto: TranscribeAudioDTO): Promise<string> {
    return "This is a mock transcript for testing purposes.";
  }
}
