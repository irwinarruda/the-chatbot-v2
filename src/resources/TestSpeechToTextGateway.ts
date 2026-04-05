import type {
  ISpeechToTextGateway,
  TranscribeAudioDTO,
} from "~/resources/ISpeechToTextGateway";

export class TestSpeechToTextGateway implements ISpeechToTextGateway {
  async transcribeAsync(_dto: TranscribeAudioDTO): Promise<string> {
    return "This is a mock transcript for testing purposes.";
  }
}
