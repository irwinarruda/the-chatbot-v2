import OpenAI from "openai";
import type { OpenAiConfig } from "~/infra/config";
import { ValidationException } from "~/infra/exceptions";
import type {
  ISpeechToTextGateway,
  TranscribeAudioDTO,
} from "~/server/resources/ISpeechToTextGateway";

export class OpenAiSpeechToTextGateway implements ISpeechToTextGateway {
  private openai: OpenAI;

  constructor(config: OpenAiConfig) {
    this.openai = new OpenAI({ apiKey: config.apiKey });
  }

  async transcribeAsync(dto: TranscribeAudioDTO): Promise<string> {
    if (dto.audioStream.length === 0) {
      return "";
    }
    if (dto.audioStream.length > 25_000_000) {
      throw new ValidationException(
        "Audio too large for transcription",
        "Use a shorter audio file (max 25 MB) and try again",
      );
    }
    const baseMimeType = dto.mimeType.split(";")[0].trim().toLowerCase();
    const extension = this.getExtensionFromMimeType(baseMimeType);
    const filename = `audio.${extension}`;
    const blob = new Blob([new Uint8Array(dto.audioStream)], {
      type: baseMimeType,
    });
    const file = new File([blob], filename, { type: baseMimeType });
    const response = await this.openai.audio.transcriptions.create({
      model: "whisper-1",
      file,
    });
    return response.text?.trim() ?? "";
  }

  private getExtensionFromMimeType(mimeType: string): string {
    switch (mimeType.toLowerCase()) {
      case "audio/ogg":
        return "ogg";
      case "audio/mpeg":
        return "mp3";
      case "audio/mp3":
        return "mp3";
      case "audio/mp4":
        return "mp4";
      case "audio/m4a":
        return "m4a";
      case "audio/x-m4a":
        return "m4a";
      case "audio/wav":
        return "wav";
      case "audio/wave":
        return "wav";
      case "audio/x-wav":
        return "wav";
      case "audio/webm":
        return "webm";
      case "audio/mpga":
        return "mpga";
      default:
        return "ogg";
    }
  }
}
