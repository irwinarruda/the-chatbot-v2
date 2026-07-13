export interface TranscribeAudioDTO {
  audioStream: Buffer;
  mimeType: string;
}

export interface ISpeechToTextGateway {
  transcribeAsync(dto: TranscribeAudioDTO): Promise<string>;
}
